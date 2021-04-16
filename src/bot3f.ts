import * as A from 'fp-ts/lib/Array';
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import { StackFrame } from 'stacktrace-js';
import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import { PhotoSize } from "telegraf/typings/telegram-types";
import { mediaGroup, PhotoGroupElement, photos } from './bot3/mediagroup';
import { parseFromContext } from './lib/bot-util';
import { ChatState, createChatHandlerFactory, emptyChatState, genericRenderFunction, getApp } from "./lib/chathandler";
import { ChatsDispatcher } from "./lib/chatsdispatcher";
import { connected4 } from "./lib/component";
import { InputHandler } from './lib/draft';
import { BasicElement, GetSetState, LocalStateAction } from "./lib/elements";
import { button, message } from "./lib/elements-constructors";
import { elementsToMessagesAndHandlers, emptyDraft, RenderDraft } from "./lib/elements-to-messages";
import { applyStoreAction, applyTreeAction, byMessageId, ChatAction, contextOpt, findRepliedTo, handlerChain, or, startHandler, withContextOpt } from "./lib/handler";
import { connect, deleteMessage, InputHandlerElementF, InputHandlerF, StateAction, routeAction } from './lib/handlerF';
import { action, casePhoto, caseText, ifTrue, inputHandler, on } from "./lib/input";
import { initLogging, mylog } from './lib/logging';
import { BotMessage, RenderedElement } from './lib/rendered-messages';
import { createStoreF, StoreAction, wrap } from './lib/store2';
import { AppActions, GetAllButtons, GetAllInputHandlers } from './lib/types-util';
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
            photoCandidates?: PhotoSize[]
        }>
    ) {

        yield inputHandler([
            on(casePassword(password), action(() => onSetVisible(true))),
            on(caseText, action(text => setStringCandidate(text))),
            on(casePhoto, action(photo => {

                const { photoCandidates } = getState({})

                mylog('inputHandler');
                // mylog({ photo });
                mylog({ photoCandidates });

                return setStateF({ photoCandidates: [...photoCandidates ?? [], photo[0]] })
            }))]
        )

        const { photoCandidates } = getState({})
        mylog('App');
        mylog({ photoCandidates });

        if (isVisible) {
            yield VisibleSecrets({})
        }

        if (stringCandidate) {
            const addItem = () => [
                onAddItem(stringCandidate),
                setStringCandidate(undefined)
            ]

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
        else if (photoCandidates) {

            const addItem = () => {
                const { photoCandidates } = getState({})
                mylog('addItem addItem');
                mylog({ photoCandidates });

                return [
                    onAddItem(photoCandidates!),
                    setStateF({ photoCandidates: undefined }),
                ]
            }

            const rejectItem = () => setStateF({ photoCandidates: undefined })

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


function createDraftWithImages<AppAction extends any>(
    elements: (BasicElement | PhotoGroupElement | InputHandlerElementF<AppAction>)[]
): RenderDraft & { inputHandlersF: InputHandlerF<AppAction>[] } {
    const draft = emptyDraft()
    const inputHandlersF: InputHandlerF<AppAction>[] = []

    function handle(compel: BasicElement | PhotoGroupElement | InputHandlerElementF<AppAction>) {
        if (compel.kind === 'PhotoGroupElement') {
            mediaGroup.appendDraft(draft, compel)
        }
        else if (compel.kind === 'InputHandlerElementF') {
            inputHandlersF.push(new InputHandlerF(compel))
        }
        else {
            elementsToMessagesAndHandlers(compel, draft)
        }
    }

    for (const compel of elements) {
        handle(compel)
    }

    return { ...draft, inputHandlersF }
}


const inputHandlerFHandler = <A>(h: InputHandler<A>) => (ctx: TelegrafContext) => {
    const d = parseFromContext(ctx)
    mylog(`TRACE ${ctx.message?.message_id}`)
    return h.element.callback(d, () => { return undefined })
}

function getInputHandler(d: RenderDraft) {
    return inputHandlerFHandler(d.inputHandlers[0])
}

const getActionHandler = <A>(rs: RenderedElement[]) => {
    return function (ctx: TelegrafContext): A | undefined {
        const { action, repliedTo } = contextOpt(ctx)
        const p = pipe(
            repliedTo
            , O.map(findRepliedTo(rs))
            , O.chain(O.fromNullable)
            , O.filter((callbackTo): callbackTo is BotMessage => callbackTo.kind === 'BotMessage')
            , O.chain(callbackTo => pipe(action, O.map(action => ({ action, callbackTo }))))
            , O.chainNullableK(({ callbackTo, action }) => callbackTo.input.callback2<A>(action))
            // , O.map(applyStoreAction)
        )

        mylog("getActionHandler")
        mylog(p)

        if (O.isSome(p)) {
            return p.value
        }
    }
}

function createApp() {
    type MyState = ReturnType<typeof createBotStoreF>
    type AppChatState = ChatState<MyState, AppAction>
    type AppStoreAction = StoreAction<State, State>
    type AppAction = AppActions<ReturnType<typeof App>>
    type AppStateAction = StateAction<AppChatState>

    const chatState = (): AppChatState => {
        return {
            ...emptyChatState(),
            ...createBotStoreF(),
        }
    }

    function actionToStateAction(a: AppAction): AppStateAction[] {
        if (Array.isArray(a)) {
            return A.flatten(a.map(actionToStateAction))
        }
        // @ts-ignore
        else if (a.kind === 'store-action')
            // @ts-ignore
            return [applyStoreAction(a)]
        // @ts-ignore
        else
            // @ts-ignore
            return [applyTreeAction(a)]
    }

    // routeAction(actionToStateAction)

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
                or(startHandler, byMessageId(connect(deleteMessage, routeAction(actionToStateAction))))
            ])),
        handleAction: async (ctx, renderer, chat, chatdata) => {
            return await pipe(
                O.fromNullable(chatdata.actionHandler)
                , O.chainNullableK(f => f(ctx))
                , O.map(actionToStateAction)
                , O.map(A.map(a => chat.handleEvent(ctx, "updated", a)))
                , O.map(a => {
                    console.log(a); return Promise.all(a)
                })
                , O.getOrElseW(() => async () => {})
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

const byfunc = (fname: string) => (fs: StackFrame[]) => fs[0].functionName ? fs[0].functionName?.indexOf(fname) > -1 : false

const grep = (ss: string) => (s: string, fs: StackFrame[]) => s.indexOf(ss) > -1

async function main() {
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