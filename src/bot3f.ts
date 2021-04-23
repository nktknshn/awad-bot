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
import { applyChatStateAction, applyStoreAction, applyTreeAction, clearChat, getActionHandler, getInputHandler, modifyRenderedElements } from "./lib/handler";
import { action, casePhoto, caseText, ifTrue, inputHandler, on } from "./lib/input";
import { initLogging, mylog } from './lib/logging';
import { AppActionsFlatten } from './lib/types-util';
import { createRendered, UserMessageElement } from './lib/usermessage';
import { token } from "./telegram-token.json";


type Context = StoreState & {
    dispatcher: ReturnType<typeof createBotStoreF>['dispatcher']
}

type ChatStateAction<R, H> = {
    kind: 'chatstate-action',
    f: (s: ChatState<R, H>) => ChatState<R, H>
}

const append = <T>(a: T) => (as: T[]) => A.snoc(as, a)

const deferRender = (n: number) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { deferRender: number }, H>(s: ChatState<R, H>): ChatState<R, H> =>
        ({ ...s, deferRender: n })
})

export const casePassword =
    (password: string) => on(caseText, ifTrue(({ messageText }) => messageText == password))

const VisibleSecrets = connected4(
    (ctx: Context) => ctx,
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


const App = connected4(
    (ctx: Context) => ctx,
    function* (
        { isVisible, stringCandidate, dispatcher: { onSetVisible, onAddItem, setStringCandidate } },
        { password }: { password: string },
        { getState, setStateF: setState }: GetSetState<{
            photoCandidates: PhotoSize[],
            userMessages: number[]
        }>
    ) {
        mylog('App');

        const { photoCandidates, userMessages, lenses } = getState({ photoCandidates: [], userMessages: [] })

        if (isVisible) {
            yield VisibleSecrets({})
            return
        }

        const resetPhotos = setState(
            F.flow(
                lenses.photoCandidates.set([]),
                lenses.userMessages.set([])
            ))

        const addUserMessage = (messageId: number) =>
            setState(lenses.userMessages.modify(append(messageId)))

        const resetUserMessages = setState(lenses.userMessages.set([]))

        const addPhotoCandidate = (photo: PhotoSize[]) =>
            setState(lenses.photoCandidates.modify(append(photo[0])))

        yield inputHandler([
            on(casePassword(password), action(() => [
                onSetVisible(true)
            ])),
            on(caseText, action(a => [
                addUserMessage(a.messageId),
                setStringCandidate(a.messageText)
            ])),
            on(casePhoto, action(({ photo, messageId }) => [
                addUserMessage(messageId),
                addPhotoCandidate(photo),
                deferRender(300)
            ]))
        ])

        if (stringCandidate) {
            const reset = [resetUserMessages, setStringCandidate(undefined)]
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

const flush = (): 'flush' => 'flush'

interface RenderEvent<AppAction> {
    kind: 'RenderEvent'
    actions?: AppAction[]
}

interface StateActionEvent<AppAction> {
    kind: 'StateActionEvent',
    actions: AppAction[]
}

const addToRendered = <R, H, E>()
    : ChatAction<R, H, ChatState<R, H>, E> => {
    return CA.ctx(c => CA.pipeState((s: ChatState<R, H>): ChatState<R, H> => ({
        ...s,
        renderedElements: [...s.renderedElements, createRendered(c.message?.message_id!)]
    })))
}

function createApp() {
    type MyState = ReturnType<typeof createBotStoreF> & {
        deferredRenderTimer?: NodeJS.Timeout,
        deferRender: number
    }

    type HandlerActions = AppActionsFlatten<typeof App>

    type Event = StateActionEvent<AppAction> | RenderEvent<AppAction>
    type AppChatState = ChatState<MyState, HandlerActions>

    type AppAction = HandlerActions
    //  | ChatStateAction<MyState, HandlerActions>
    //  | RenderedElementsAction
    // type AppStoreAction = StoreAction<StoreState, StoreState>

    // // type AppStateAction = StateAction<AppChatState>

    type AppStateAction = ChatAction<MyState, HandlerActions, ChatState<MyState, HandlerActions>, Event>

    // type AppChatAction<R> = ChatAction<MyState, HandlerActions, R, Event, AppChatState>
    // type AppChatActionM<R> = ChatAction<MyState, HandlerActions, [R, AppChatState], Event, AppChatState>

    const chatState = (): AppChatState => {
        return {
            ...emptyChatState(),
            ...createBotStoreF(),
            deferRender: 0
        }
    }

    function actionToStateAction(a: AppAction | AppAction[]): AppStateAction[] {
        if (Array.isArray(a))
            return A.flatten(a.map(actionToStateAction))
        else if (a === 'flush') {
            return [async ({ chatdata, tctx }) => {

                for (const r of chatdata.renderedElements) {
                    for (const id of r.outputIds()) {
                        await tracker.removeRenderedMessage(tctx.chat?.id!, id)
                    }
                }

                return pipe(
                    chatdata,
                    modifyRenderedElements(_ => [])
                )
            }]
        }
        else if (a.kind === 'store-action') {
            return [CA.pipeState(applyStoreAction(a))]
        }
        else if (a.kind === 'localstate-action')
            return [CA.pipeState(applyTreeAction(a))]
        else if (a.kind === 'chatstate-action') {
            return [CA.pipeState(applyChatStateAction(a.f))]
        }
        // else if (a.kind === 'rendered-elements-action') {
        //     return [CA.pipeState(applyRenderedElementsAction(a))]
        // }

        return a
    }

    const { renderer, saveToTracker, cleanChat, tracker } = getTrackingRenderer(
        LevelTracker(createDatabase('./mydb'))
    )

    return getApp<MyState, HandlerActions, Event>({
        renderer,
        chatData: chatState,
        renderFunc: genericRenderFunction(
            App, { password: 'a' },
            chatstate => ({ dispatcher: chatstate.dispatcher, ...chatstate.store.state }),
            createDraftWithImages,
            getInputHandler,
            getActionHandler
        ),
        init: async (app, ctx, renderer, queue, chatdata) => {
            await cleanChat(ctx.chat?.id!)(renderer)

            chatdata.store.notify = (a) => queue.handleEvent(ctx, {
                kind: 'StateActionEvent',
                actions: [a]
            })
        },
        queueStrategy: function () {

        },
        handleMessage: CA.branchHandler<MyState, HandlerActions, Event>([
            [
                CA.ifTextEqual('/start'),
                [addToRendered(), clearChat, CA.render],
                [
                    addToRendered(),
                    saveToTracker(),
                    CA.applyInputHandler(actionToStateAction),
                    CA.chatState(c => c.deferRender == 0
                        ? CA.render
                        : CA.scheduleEvent(c.deferRender, {
                            kind: 'RenderEvent'
                        }))
                ]
            ],
        ]),
        handleAction: CA.listHandler(
            [CA.applyActionHandler(actionToStateAction), CA.replyCallback, CA.render]
        ),
        handleEvent: async (ctx, event) => {
            if (event.kind === 'StateActionEvent') {
                return await ctx.app.renderFunc(
                    await CA.runActionsChain(
                        actionToStateAction(event.actions))
                        (ctx)
                )[1](ctx.renderer)
            }
            else if (event.kind === 'RenderEvent') {
                return await ctx.app.renderFunc(event.actions
                    ? await CA.runActionsChain(
                        actionToStateAction(event.actions))
                        (ctx)
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