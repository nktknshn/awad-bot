import * as A from 'fp-ts/lib/Array';
import * as F from 'fp-ts/lib/function';
import { pipe } from "fp-ts/lib/pipeable";
import { StackFrame } from 'stacktrace-js';
import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import { PhotoSize } from "telegraf/typings/telegram-types";
import { createDatabase, LevelTracker } from './bot3/leveltracker';
import { photos } from './bot3/mediagroup';
import { createBotStoreF, StoreState } from './bot3/store';
import * as CA from './lib/chatactions';
import { ChatAction } from './lib/chatactions';
import { ChatState, createChatHandlerFactory, emptyChatState, genericRenderFunction, getApp } from "./lib/chathandler";
import { getTrackingRenderer } from './lib/chatrenderer';
import { ChatsDispatcher } from "./lib/chatsdispatcher";
import { connected4 } from "./lib/component";
import { createDraftWithImages } from './lib/draft';
import { GetSetState } from "./lib/elements";
import { button, message } from "./lib/elements-constructors";
import { clearChat, getActionHandler, getInputHandler, modifyRenderedElements } from "./lib/handler";
import { action, casePhoto, caseText, ifTrue, inputHandler, on } from "./lib/input";
import { initLogging, mylog } from './lib/logging';
import { AppActionsFlatten } from './lib/types-util';
import { createRendered, UserMessageElement } from './lib/usermessage';
import { token } from "./telegram-token.json";
import { composeChatActionMatchers, defaultActionToChatAction, defaultMatcher, makeActionToChatAction, storeMatcher } from './trying1';

type AppContext = StoreState & {
    dispatcher: ReturnType<typeof createBotStoreF>['dispatcher']
}

const append = <T>(a: T) => (as: T[]) => A.snoc(as, a)

export const casePassword =
    (password: string) => on(caseText, ifTrue(({ messageText }) => messageText == password))

const VisibleSecrets = connected4(
    (ctx: AppContext) => ctx,
    function* (
        { items, secondsLeft, dispatcher: { onDeleteItem, onSetVisible, onSetSecondsLeft } }
    ) {

        mylog(`TRACE ${items}`)

        const strings = pipe(
            items,
            A.partition((_): _ is string => typeof _ === 'string'),
            ({ right }) => right
        )

        const phots = pipe(
            items,
            A.partition((_): _ is PhotoSize => typeof _ !== 'string'),
            ({ right }) => right
        )

        if (phots.length > 0)
            yield photos(phots.map(_ => _.file_id))

        for (const item of strings) {
            yield message(item)
            yield button('Delete', () => onDeleteItem(item))
        }

        yield message("Secrets!")
        yield button(`Hide`, () => onSetVisible(false))
        yield button([`More time (${secondsLeft} secs)`, 'more'], () => {
            mylog(`TRACE More time clicked ${secondsLeft} -> onSetSecondsLeft(${secondsLeft + 30})`)
            return onSetSecondsLeft(secondsLeft + 30)
        })
    }
)


export const App = connected4(
    (ctx: AppContext) => ctx,
    function* (
        { isVisible, dispatcher: { onSetVisible, onAddItem } },
        { password }: { password: string },
        { getState, setStateF: setState }: GetSetState<{
            photoCandidates: PhotoSize[],
            userMessages: number[],
            stringCandidate?: string
        }>
    ) {
        mylog('App');

        const { photoCandidates, stringCandidate, userMessages, lenses } = getState({
            photoCandidates: [],
            userMessages: [],
            stringCandidate: undefined
        })

        if (isVisible) {
            yield VisibleSecrets({})
            return
        }

        const addPhotoCandidate = (photo: PhotoSize[]) =>
            setState(lenses.photoCandidates.modify(append(photo[0])))


        const resetPhotos = setState(
            F.flow(
                lenses.photoCandidates.set([]),
                lenses.userMessages.set([])
            ))

        const addUserMessage = (messageId: number) =>
            setState(lenses.userMessages.modify(append(messageId)))

        const resetUserMessages = setState(lenses.userMessages.set([]))

        yield inputHandler([
            on(casePassword(password), action(() => [
                onSetVisible(true)
            ])),
            on(caseText, action(a => [
                addUserMessage(a.messageId),
                setState(lenses.stringCandidate.set(a.messageText))
            ])),
            on(casePhoto, action(({ photo, messageId }) => [
                addUserMessage(messageId),
                addPhotoCandidate(photo),
                deferRender(300)
            ]))
        ])

        if (stringCandidate) {
            const reset = [resetUserMessages, setState(lenses.stringCandidate.set(undefined))]
            const addItem = [onAddItem(stringCandidate), reset]
            const rejectItem = reset

            if (!isVisible) {

                for (const m of userMessages) {
                    yield new UserMessageElement(m)
                }

                yield message(`Add?`)
                yield button(`Yes`, () => addItem)
                yield button(`No`, () => rejectItem)
            }
            return
        }
        else if (photoCandidates.length) {
            const reset = [
                resetUserMessages,
                resetPhotos,
                deferRender(0)
            ]

            const addItem = [
                onAddItem(photoCandidates),
                reset,
            ]

            if (!isVisible) {

                for (const m of userMessages) {
                    yield new UserMessageElement(m)
                }

                yield message(`Add ${photoCandidates.length} photos?`)
                yield button(`Yes`, () => addItem)
                yield button(`No`, () => reset)

            }
            return
        }

        yield message("hi")
        yield button('flush', flush)
    }
)

const flush = () => ({
    kind: 'flush' as 'flush'
})

interface RenderEvent<AppAction> {
    kind: 'RenderEvent'
    actions?: AppAction[]
}

interface StateActionEvent<AppAction> {
    kind: 'StateActionEvent',
    actions: AppAction[]
}


const addToRendered = <R, H, E>()
    : CA.PipeChatAction<R, H, E> => {
    return CA.ctx(c =>
        CA.pipeState(s => ({
            ...s,
            renderedElements: [
                ...s.renderedElements,
                createRendered(c.message?.message_id!)
            ]
        })))
}

export const deferRender = (n: number) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { deferRender: number }>(s: R) =>
        ({ ...s, deferRender: n })
})


function createApp() {

    type AppAction = AppActionsFlatten<typeof App>
    type Event = StateActionEvent<AppAction> | RenderEvent<AppAction>
    type AppChatState = ChatState<MyState, AppAction>
    type AppChatAction = CA.AppChatAction<MyState, AppAction, Event>

    type MyState =
        ReturnType<typeof createBotStoreF> &
        {
            deferredRenderTimer?: NodeJS.Timeout,
            deferRender: number
        }

    const chatDataFactory = (): AppChatState => {
        return {
            ...emptyChatState(),
            ...createBotStoreF(),
            deferRender: 0
        }
    }

    const { renderer, saveToTracker, cleanChat, tracker } = getTrackingRenderer(
        LevelTracker(createDatabase('./mydb'))
    )

    return getApp<MyState, AppAction, Event>({
        actionToChatAction: makeActionToChatAction(
            composeChatActionMatchers(
                defaultMatcher(),
                storeMatcher(),
                ({
                    isA: (a: { kind: 'flush' } | any): a is { kind: 'flush' } => a.kind === 'flush',
                    f: (): AppChatAction => {
                        return async ({ chatdata, tctx }) => {
                            for (const r of chatdata.renderedElements) {
                                for (const id of r.outputIds()) {
                                    await tracker.untrackRenderedMessage(tctx.chat?.id!, id)
                                }
                            }

                            return pipe(
                                chatdata,
                                modifyRenderedElements(_ => [])
                            )
                        }
                    }
                }),
            )
        ),
        renderer,
        chatDataFactory,
        renderFunc: genericRenderFunction(
            App, { password: 'a' },
            chatstate => ({ dispatcher: chatstate.dispatcher, ...chatstate.store.state }),
            createDraftWithImages,
            getInputHandler,
            getActionHandler
        ),
        init: async ({ tctx, renderer, chat, chatdata }) => {
            await cleanChat(tctx.chat?.id!)(renderer)

            chatdata.store.notify = (a) => chat.handleEvent(tctx, {
                kind: 'StateActionEvent',
                actions: [a]
            })
        },

        handleMessage: CA.branchHandler([
            [
                CA.ifTextEqual('/start'),
                [addToRendered(), clearChat, CA.render],
                [
                    addToRendered(),
                    saveToTracker(),
                    CA.applyInputHandler(),
                    CA.chatState(c => c.deferRender == 0
                        ? CA.render
                        : CA.scheduleEvent(c.deferRender, {
                            kind: 'RenderEvent'
                        }))
                ]
            ],
        ]),
        handleAction: CA.fromList(
            [CA.applyActionHandler(), CA.replyCallback, CA.render]
        ),
        handleEvent: async (ctx, event) => {
            if (event.kind === 'StateActionEvent') {
                return await ctx.app.renderFunc(
                    await CA.runActionsChain(ctx.app.actionToChatAction(event.actions))(ctx)
                )[1](ctx.renderer)
            }
            else if (event.kind === 'RenderEvent') {
                return await ctx.app.renderFunc(
                    event.actions
                        ? await CA.runActionsChain(ctx.app.actionToChatAction(event.actions))(ctx)
                        : ctx.chatdata
                )[1](ctx.renderer)
            }
            // else if (event.kind === 'ChatActionEvent') {
            //     await event.a(app, event.ctx, renderer, queue, chatdata)
            //     return event.f(chatdata)
            // }
            return ctx.chatdata
        },
    })
}


async function main() {

    const byfunc = (fname: string) => (fs: StackFrame[]) => fs[0].functionName ? fs[0].functionName?.indexOf(fname) > -1 : false

    const grep = (ss: string) => (s: string, fs: StackFrame[]) => s.indexOf(ss) > -1

    initLogging([
        () => true
        // byfunc('.renderActions'),
        // byfunc('createChatHandlerFactory'),
        // grep('handleMessage'),
        // // grep('handleAction'),
        // grep('QueuedChatHandler'),
        // grep('TRACE'),
        // grep('routeAction'),
        // grep('deleteMessage'),
        // grep('inputHandler'),
        // grep('tree.nextStateTree.state'),
        // grep('getState'),
        // grep('StoreF.apply'),
    ])

    const bot = new Telegraf(token)
    const dispatcher = new ChatsDispatcher(
        createChatHandlerFactory(createApp())
    )

    bot.on('message', dispatcher.messageHandler)
    bot.action(/.+/, dispatcher.actionHandler)

    bot.catch((err: any, ctx: TelegrafContext) => {
        console.error(`Ooops, encountered an error for ${ctx.updateType}`, err)
    })

    mylog('Starting the bot...')

    await bot.launch()

    mylog('Started...')
}

main()