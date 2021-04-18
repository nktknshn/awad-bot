import * as A from 'fp-ts/lib/Array';
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import { StackFrame } from 'stacktrace-js';
import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import { PhotoSize } from "telegraf/typings/telegram-types";
import { photos } from './bot3/mediagroup';
import { ChatState, createChatHandlerFactory, emptyChatState, genericRenderFunction, getApp } from "./lib/chathandler";
import { ChatsDispatcher } from "./lib/chatsdispatcher";
import { connected4 } from "./lib/component";
import { createDraftWithImages } from './lib/draft';
import { GetSetState } from "./lib/elements";
import { button, message } from "./lib/elements-constructors";
import { applyStoreAction, applyTreeAction, byMessageId, getActionHandler, getInputHandler, handlerChain, or, startHandler, withContextOpt } from "./lib/handler";
import { connect, deleteMessage, getActions, routeAction, StateAction } from './lib/handlerF';
import { action, casePhoto, caseText, ifTrue, inputHandler, on } from "./lib/input";
import { initLogging, mylog } from './lib/logging';
import { createStoreF, StoreAction, wrap } from './lib/store2';
import { AppActions } from './lib/types-util';
import { token } from "./telegram-token.json";


type Item = string | PhotoSize

type Context = State & {
    dispatcher: ReturnType<typeof createBotStoreF>['dispatcher']
}

export const casePassword =
    (password: string) => on(caseText, ifTrue(text => text == password))


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
        { getState, setStateF }: GetSetState<{
            photoCandidates: PhotoSize[]
        }>
    ) {
        mylog('App');

        const { photoCandidates } = getState({ photoCandidates: [] })

        const resetPhotos = setStateF(({ photoCandidates }) => ({ photoCandidates: [] }))
        const addPhoto = (photo: PhotoSize[]) =>
            setStateF(({ photoCandidates }) => ({ photoCandidates: [...photoCandidates ?? [], photo[0]] }))

        yield inputHandler([
            on(casePassword(password), action(() => onSetVisible(true))),
            on(caseText, action(text => setStringCandidate(text))),
            on(casePhoto, action(addPhoto))]
        )

        if (isVisible) {
            yield VisibleSecrets({})
        }

        if (stringCandidate) {
            const addItem = () => [onAddItem(stringCandidate), setStringCandidate(undefined)]
            const rejectItem = () => setStringCandidate(undefined)

            if (!isVisible) {
                yield message(`Add '${stringCandidate}?'`)
                yield button(`Yes`, addItem)
                yield button(`No`, rejectItem)
            }
            else {
                // yield effect(addItem)
            }
        }
        else if (photoCandidates.length) {

            const addItem = () => [onAddItem(photoCandidates), resetPhotos]
            const rejectItem = () => resetPhotos

            if (!isVisible) {
                yield message(`Add?`)
                yield button(`Yes`, addItem)
                yield button(`No`, rejectItem)

                if (photoCandidates.length)
                    yield photos(photoCandidates.map(_ => _.file_id))
            }
            else {
                // yield effect(addItem)
            }
        }
        else if (!isVisible) {
            yield message("hi")
        }
    }
)



function createApp() {
    type MyState = ReturnType<typeof createBotStoreF>
    type AppAction = AppActions<ReturnType<typeof App>>
    type AppChatState = ChatState<MyState, AppAction>
    type AppStoreAction = StoreAction<State, State>
    type AppStateAction = StateAction<AppChatState>

    const chatState = (): AppChatState => {
        return {
            ...emptyChatState(),
            ...createBotStoreF(),
        }
    }

    function actionToStateAction(a: AppAction): AppStateAction[] {
        if (Array.isArray(a))
            return A.flatten(a.map(actionToStateAction))
        else if (a.kind === 'store-action')
            return [applyStoreAction(a)]
        else if (a.kind === 'localstate-action')
            return [applyTreeAction(a)]

        return a
    }

    return getApp({
        chatData: chatState,
        renderFunc: genericRenderFunction(
            App, { password: 'a' },
            chatstate => ({ dispatcher: chatstate.dispatcher, ...chatstate.store.state }),
            createDraftWithImages,
            getInputHandler,
            getActionHandler
        ),
        init: async (ctx, renderer, chat, chatdata) => {
            chatdata.store.notify = (a) => chat.handleEvent(ctx, "updated", applyStoreAction(a))
        },
        handleMessage: withContextOpt(
            handlerChain([
                or(startHandler, byMessageId(
                    connect(deleteMessage,
                        connect(getActions, routeAction(actionToStateAction)))
                ))
            ])),
        handleAction: async (ctx, renderer, chat, chatdata) => {
            return await pipe(
                O.fromNullable(chatdata.actionHandler)
                , O.chainNullableK(f => f(ctx))
                , O.map(actionToStateAction)
                , O.map(A.map(a => chat.handleEvent(ctx, "updated", a)))
                , O.map(a => {
                    return Promise.all(a)
                })
                , O.getOrElseW(() => async () => { })
            )
        }
    })
}


type State = {
    isVisible: boolean,
    items: (string | PhotoSize)[],
    secondsLeft: number,
    timer: NodeJS.Timeout | undefined,
    stringCandidate: string | undefined,
}

function createBotStoreF() {
    const { store } = createStoreF<State>({
        isVisible: false,
        items: [],
        secondsLeft: 0,
        timer: undefined,
        stringCandidate: undefined
    })

    type Action<S> = (s: S) => S

    const upd = (u: Partial<State>) => (s: State) => ({ ...s, ...u })
    const updF = (
        f: (s: State) => Action<State>
    ) => (s: State) => f

    const onSetSecondsLeft = (secondsLeft: number): Action<State> => (s: State) => {
        return upd({ secondsLeft })(s)
    }

    const updateSeconds = (): Action<State> => (s: State) => {
        if (s.secondsLeft > 0)
            return onSetSecondsLeft(s.secondsLeft - 1)(s)
        else
            return onSetVisible(false)(s)
    }

    const onSetVisible = (isVisible: boolean): Action<State> => (s) => {

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

    const onAddItem = (item: string | PhotoSize[]) => (s: State) => {
        mylog('TRACE onAddItem')
        mylog(item)

        return upd({ items: [...s.items, ...Array.isArray(item) ? item : [item]] })(s)
    }

    const onDeleteItem = (item: string | PhotoSize) => (s: State) => {
        return upd({ items: s.items.filter(_ => _ != item) })(s)
    }

    const setStringCandidate = (c?: string) => (s: State) => upd({ stringCandidate: c })(s)

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