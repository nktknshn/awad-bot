import * as A from 'fp-ts/lib/Array';
import * as F from 'fp-ts/lib/function';
import { pipe } from "fp-ts/lib/pipeable";
import { StackFrame } from 'stacktrace-js';
import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import { PhotoSize } from "telegraf/typings/telegram-types";
import { levelDatabase, levelTracker } from './bot3/leveltracker';
import { photos } from './bot3/mediagroup';
import { createBotStoreF, StoreState } from './bot3/store';
import { append, deferRender, flush, RenderEvent, StateActionEvent } from './bot3/util';
import * as CA from './lib/chatactions';
import { createChatHandlerFactory } from "./lib/chathandler";
import { ChatState, createChatState, getApp, renderComponent } from "./lib/application";
import { getTrackingRenderer } from './lib/chatrenderer';
import { ChatsDispatcher } from "./lib/chatsdispatcher";
import { connected } from "./lib/component";
import { button, message } from "./lib/elements-constructors";
import { action, casePhoto, caseText, ifTrue, inputHandler, on } from "./lib/input";
import { clearChat, modifyRenderedElements } from "./lib/inputhandler";
import { initLogging, mylog } from './lib/logging';
import { extendDefaultReducer, flushReducer, storeStateMatcher, storeReducer, reducerToFunction } from './lib/reducer';
import { AppActionsFlatten } from './lib/types-util';
import { UserMessageElement } from './lib/usermessage';
import { token } from "./telegram-token.json";
import { GetSetState } from 'Libtree2';
import { applyActionEventReducer, ApplyActionsEvent, makeEventReducer, applyActionEvent } from 'Lib/event';

type AppContext = StoreState & {
    dispatcher: ReturnType<typeof createBotStoreF>['dispatcher']
}


export const casePassword =
    (password: string) => on(caseText, ifTrue(({ messageText }) => messageText == password))

const VisibleSecrets = connected(
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


export const App = connected(
    (ctx: AppContext) => ctx,
    function* (
        { isVisible, dispatcher: { onSetVisible, onAddItem } },
        { password }: { password: string },
        { getState, setState, lenses }: GetSetState<{
            photoCandidates: PhotoSize[],
            userMessages: number[],
            stringCandidate?: string
        }>
    ) {
        mylog('App');

        const { photoCandidates, stringCandidate, userMessages } = getState({
            photoCandidates: [],
            userMessages: [],
            stringCandidate: undefined
        })

        if (isVisible) {
            yield VisibleSecrets({})
            return
        }

        const addPhotoCandidate = (photo: PhotoSize[]) =>
            setState(lenses('photoCandidates').modify(append(photo[0])))


        const resetPhotos = setState(
            F.flow(
                lenses('photoCandidates').set([]),
                lenses('userMessages').set([])
            ))

        const addUserMessage = (messageId: number) =>
            setState(lenses('userMessages').modify(append(messageId)))

        const resetUserMessages = setState(lenses('userMessages').set([]))

        yield inputHandler([
            on(casePassword(password), action(() => [
                onSetVisible(true)
            ])),
            on(caseText, action(a => [
                addUserMessage(a.messageId),
                setState(lenses('stringCandidate').set(a.messageText))
            ])),
            on(casePhoto, action(({ photo, messageId }) => [
                addUserMessage(messageId),
                addPhotoCandidate(photo),
                deferRender(300)
            ]))
        ])

        if (stringCandidate) {
            const reset = [
                resetUserMessages,
                setState(lenses('stringCandidate').set(undefined))
            ]
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

function createApp() {

    type AppAction = AppActionsFlatten<typeof App>
    type AppEvent = ApplyActionsEvent<MyState, AppAction, AppEvent>
    type AppChatState = ChatState<MyState, AppAction>
    type AppChatAction = CA.AppChatAction<MyState, AppAction, Event>

    type MyState =
        ReturnType<typeof createBotStoreF> &
        {
            deferredRenderTimer?: NodeJS.Timeout,
            deferRender: number
        }

    const chatDataFactory = (): AppChatState => {
        return createChatState({
            ...createBotStoreF(),
            deferRender: 0
        })
    }

    const { renderer, saveToTrackerAction: saveToTracker, cleanChat,
        untrackRendererElementsAction } = getTrackingRenderer(
            levelTracker(levelDatabase('./mydb'))
        )

    return getApp<MyState, AppAction, AppEvent>({
        actionReducer: extendDefaultReducer(
            flushReducer(
                CA.sequence([
                    untrackRendererElementsAction,
                    CA.flush
                ])
            ),

            storeReducer()
        ),
        renderer,
        chatStateFactory: chatDataFactory,
        renderFunc: renderComponent(
            {
                component: App,
                props: { password: 'a' },
                contextCreator: chatstate => ({ dispatcher: chatstate.dispatcher, ...chatstate.store.state }),
            }
        ),
        init: async ({ tctx, app, renderer, queue: chat, chatdata }) => {
            await cleanChat(tctx.chat?.id!)(renderer)

            chatdata.store.notify = (a) => chat.handleEvent(tctx,
                applyActionEvent(app.actionReducer(a)))

            return chatdata
        },
        handleMessage: CA.branchHandler([
            [
                CA.ifTextEqual('/start'),
                [CA.addRenderedUserMessage(), clearChat, CA.render],
                [
                    CA.addRenderedUserMessage(),
                    saveToTracker,
                    CA.applyInputHandler,
                    CA.chatState(c =>
                        c.deferRender == 0
                            ? CA.render
                            : CA.scheduleEvent(c.deferRender,
                                applyActionEvent([])))
                ]
            ],
        ]),
        handleAction: CA.sequence(
            [CA.applyActionHandler, CA.replyCallback, CA.render]
        ),
        handleEvent: makeEventReducer(applyActionEventReducer())
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