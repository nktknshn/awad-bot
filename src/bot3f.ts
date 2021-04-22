import * as A from 'fp-ts/lib/Array';
import * as O from 'fp-ts/lib/Option';
import * as F from 'fp-ts/lib/function';
import * as T from 'fp-ts/lib/Task';

import { pipe } from "fp-ts/lib/pipeable";
import { StackFrame } from 'stacktrace-js';
import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import { PhotoSize } from "telegraf/typings/telegram-types";
import { photos } from './bot3/mediagroup';
import { Application, ChatState, createChatHandlerFactory, emptyChatState, genericRenderFunction, getApp } from "./lib/chathandler";
import { ChatsDispatcher } from "./lib/chatsdispatcher";
import { connected4 } from "./lib/component";
import { createDraftWithImages } from './lib/draft';
import { GetSetState, RenderedElementsAction, wrapR } from "./lib/elements";
import { button, effect, message } from "./lib/elements-constructors";
import { applyChatStateAction, applyRenderedElementsAction, applyStoreAction, applyTreeAction, byMessageId, chainInputHandlers, ChatAction, contextOpt, ContextOpt, clearChat, getActionHandler, getInputHandler, handlerChain, or, startHandler, withContextOpt } from "./lib/handler";
import { StateAction } from './lib/handlerF';
import { action, actionMapped, casePhoto, caseText, ifTrue, inputHandler, on, otherwise } from "./lib/input";
import { initLogging, mylog } from './lib/logging';
import { createStoreF, StoreAction, wrap } from './lib/store2';
import { AppActions, AppActionsFlatten } from './lib/types-util';
import { token } from "./telegram-token.json";
import { task } from 'fp-ts/lib/Task';
import { addRenderedUserMessage, createRendered, OutcomingUserMessage, RenderedUserMessage, UserMessageElement } from './lib/usermessage';
import { Lens } from 'monocle-ts'
import { RenderedElement } from './lib/rendered-messages';
import { parseFromContext } from './lib/bot-util';
import * as CA from './lib/chatactions'
import { getTrackingRenderer, removeMessages, Tracker } from './lib/chatrenderer';
import { createDatabase, LevelTracker } from './bot3/leveltracker'

type Item = string | PhotoSize

type Context = StoreState & {
    dispatcher: ReturnType<typeof createBotStoreF>['dispatcher']
}

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

const append = <T>(a: T) => (as: T[]) => A.snoc(as, a)
const defer = (n: number) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <S extends { deferRender: number }>(s: S) => ({ ...s, deferRender: n })
})

const App = connected4(
    (ctx: Context) => ctx,
    function* (
        { isVisible, stringCandidate, dispatcher: { onSetVisible, onAddItem, setStringCandidate } },
        { password }: { password: string },
        { getState, setStateF }: GetSetState<{
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

        const resetPhotos = setStateF(
            F.flow(
                lenses.photoCandidates.set([]),
                lenses.userMessages.set([])
            ))

        const addUserMessage = (messageId: number) =>
            setStateF(lenses.userMessages.modify(append(messageId)))

        const resetUserMessages = setStateF(lenses.userMessages.set([]))

        const addPhotoCandidate = (photo: PhotoSize[]) =>
            setStateF(lenses.photoCandidates.modify(append(photo[0])))

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
                defer(300)
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
            const reset = [resetUserMessages, resetPhotos]
            const addItem = [onAddItem(photoCandidates), reset, defer(0)]

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

function createApp() {
    type MyState = ReturnType<typeof createBotStoreF> & {
        deferredRenderTimer?: NodeJS.Timeout,
        deferRender: number
    }

    type HandlerActions = AppActionsFlatten<typeof App>
    type ChatStateAction = {
        kind: 'chatstate-action',
        f: (s: AppChatState) => AppChatState
    }

    type AppAction = HandlerActions | ChatStateAction | RenderedElementsAction

    type AppChatState = ChatState<MyState, HandlerActions>
    type AppStoreAction = StoreAction<StoreState, StoreState>
    type AppStateAction = StateAction<AppChatState>
    type AppChatAction<R> = ChatAction<MyState, HandlerActions, R, Event, AppChatState>
    type AppChatActionM<R> = ChatAction<MyState, HandlerActions, [R, AppChatState], Event, AppChatState>

    type Event = StateActionEvent | RenderEvent | {
        kind: 'ChatActionEvent',
        a: ChatAction<MyState, HandlerActions, void, Event, AppChatState>,
        f: (s: AppChatState) => AppChatState
        ctx: TelegrafContext
    }

    interface RenderEvent {
        kind: 'RenderEvent'
        actions?: AppAction[]
    }

    interface StateActionEvent {
        kind: 'StateActionEvent',
        actions: AppAction[]
    }

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
            return [applyRenderedElementsAction({
                kind: 'rendered-elements-action',
                f: _ => []
            })]
        }
        else if (a.kind === 'store-action')
            return [applyStoreAction(a)]
        else if (a.kind === 'localstate-action')
            return [applyTreeAction(a)]
        else if (a.kind === 'chatstate-action') {
            return [applyChatStateAction(a.f)]
        }
        else if (a.kind === 'rendered-elements-action') {
            return [applyRenderedElementsAction(a)]
        }

        // else if (a.kind === 'chat-action') {
        //     return [applyChatStateAction(a.f)]
        // }

        return a
    }

    const { renderer, saveToTracker, removeAll } = getTrackingRenderer(
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
            await removeAll(ctx.chat?.id!)(renderer)

            chatdata.store.notify = (a) => queue.handleEvent({
                kind: 'StateActionEvent',
                actions: [a]
            })
        },
        queueStrategy: function () {

        },
        handleMessage: CA.branchHandler([
            [
                CA.ifStart,
                [CA.addToRendered(actionToStateAction), clearChat, CA.render],
                [
                    CA.addToRendered(actionToStateAction),
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
        handleEvent: async (app, renderer, queue, chatdata, event) => {
            if (event.kind === 'StateActionEvent') {
                return await app.renderFunc(
                    actionToStateAction(event.actions).reduce((s, f) => f(s), chatdata)
                )[1](renderer)
            }
            else if (event.kind === 'RenderEvent') {
                return await app.renderFunc(event.actions
                    ? actionToStateAction(event.actions).reduce((s, f) => f(s), chatdata)
                    : chatdata
                )[1](renderer)
            }
            else if (event.kind === 'ChatActionEvent') {
                await event.a(app, event.ctx, renderer, queue, chatdata)
                return event.f(chatdata)
            }
            return chatdata
        },
    })
}


type StoreState = {
    isVisible: boolean,
    items: (string | PhotoSize)[],
    secondsLeft: number,
    timer: NodeJS.Timeout | undefined,
    stringCandidate: string | undefined,
}

function createBotStoreF() {

    const { store } = createStoreF<StoreState>({
        isVisible: false,
        items: [],
        secondsLeft: 0,
        timer: undefined,
        stringCandidate: undefined
    })

    type Action<S> = (s: S) => S

    const upd = (u: Partial<StoreState>) => (s: StoreState) => ({ ...s, ...u })
    const updF = (
        f: (s: StoreState) => Action<StoreState>
    ) => (s: StoreState) => f

    const onSetSecondsLeft = (secondsLeft: number): Action<StoreState> => (s: StoreState) => {
        return upd({ secondsLeft })(s)
    }

    const updateSeconds = (): Action<StoreState> => (s: StoreState) => {
        if (s.secondsLeft > 0)
            return onSetSecondsLeft(s.secondsLeft - 1)(s)
        else
            return onSetVisible(false)(s)
    }

    const onSetVisible = (isVisible: boolean): Action<StoreState> => (s) => {

        s = upd({ isVisible })(s)

        if (isVisible) {
            const timer = setInterval(() => store.notify(wrap(updateSeconds)()), 1000)
            return upd({
                secondsLeft: 15,
                timer
            })(s)
        }
        else {
            s.timer && clearInterval(s.timer)

            return upd({ timer: undefined })(s)
        }
    }

    const onAddItem = (item: string | PhotoSize[]) => (s: StoreState) => {
        mylog('TRACE onAddItem')
        mylog(item)

        return upd({ items: [...s.items, ...Array.isArray(item) ? item : [item]] })(s)
    }

    const onDeleteItem = (item: string | PhotoSize) => (s: StoreState) => {
        return upd({ items: s.items.filter(_ => _ != item) })(s)
    }

    const setStringCandidate = (c?: string) => (s: StoreState) => upd({ stringCandidate: c })(s)

    return {
        store,
        dispatcher: {
            onSetVisible: wrap(onSetVisible),
            onAddItem: wrap(onAddItem),
            onSetSecondsLeft: wrap(onSetSecondsLeft),
            onDeleteItem: wrap(onDeleteItem),
            setStringCandidate: wrap(setStringCandidate)
        }
    }

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