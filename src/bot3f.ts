import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/lib/Option';

import { flow } from "fp-ts/lib/function"
import { pipe } from "fp-ts/lib/pipeable"
import { StackFrame } from 'stacktrace-js'
import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { PhotoSize } from "telegraf/typings/telegram-types"
import { mediaGroup, PhotoGroupElement, photos } from './bot3/mediagroup'
import { parseFromContext } from './lib/bot-util'
import { ChatHandler2, ChatState, createChatHandlerFactory, emptyChatState, genericRenderFunction, getApp } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"
import { connected4 } from "./lib/component"
import { BasicElement, GetSetState } from "./lib/elements"
import { button, message } from "./lib/elements-constructors"
import { elementsToMessagesAndHandlers, emptyDraft, RenderDraft } from "./lib/elements-to-messages"
import { ChatAction, ContextOpt, contextOpt, defaultHandler, findRepliedTo, handlerChain, or, startHandler, withContextOpt } from "./lib/handler"
import { Action, InputHandlerElementF, InputHandlerF, inputHandlerF } from './lib/handlerF'
import { action, casePhoto, caseText, ifTrue, nextHandler, on } from "./lib/input"
import { initLogging, mylog } from './lib/logging'
import { createStore } from "./lib/store2"
import { token } from "./telegram-token.json"

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
            yield button('Delete', async () => { onDeleteItem(item) })
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
        { getState, setState }: GetSetState<{
            photoCandidates?: PhotoSize[]
        }>
    ) {

        yield inputHandlerF(
            on(casePassword(password), action(() => onSetVisible(true))),
            on(caseText, action(text => setStringCandidate(text))),
            on(casePhoto, action(photo => {

                const { photoCandidates } = getState({})

                mylog({ photo });
                mylog({ photoCandidates });

                setState({ photoCandidates: [...photoCandidates ?? [], photo[0]] })
                return nextHandler()
            }))
        )

        const { photoCandidates } = getState({})

        if (isVisible) {
            yield VisibleSecrets({})
        }

        if (stringCandidate) {
            const addItem = () => flow(
                onAddItem(stringCandidate),
                setStringCandidate(undefined)
            )

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

            const addItem = () => { setState({ photoCandidates: undefined }); return onAddItem(photoCandidates) }
            const rejectItem = () => { setState({ photoCandidates: undefined }); return undefined }

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


function createDraftWithImages(
    elements: (BasicElement | PhotoGroupElement | InputHandlerElementF<State>)[]
): RenderDraft & { inputHandlersF: InputHandlerF<State>[] } {
    const draft = emptyDraft()
    const inputHandlersF: InputHandlerF<State>[] = []

    function handle(compel: BasicElement | PhotoGroupElement | InputHandlerElementF<State>) {
        if (compel.kind === 'PhotoGroupElement') {
            mediaGroup.appendDraft(draft, compel)
        }
        else if (compel.kind === 'InputHandlerElementF') {
            inputHandlersF.push(new InputHandlerF(compel))
        }
        // else if (compel.kind === 'ButtonElementF') {
        //     // mediaGroup.appendDraft(draft, compel)
        //     pipe(
        //         A.last(filterMapTextMessages(draft.messages)),
        //         O.map(_ => _.message.addButton(compel))
        //     )
        // }
        else {
            elementsToMessagesAndHandlers(compel, draft)
        }
    }

    for (const compel of elements) {
        handle(compel)
    }

    return { ...draft, inputHandlersF }
}


const inputHandlerFHandler = (h: InputHandlerF<State>) => (ctx: TelegrafContext) => {
    const c = contextOpt(ctx)
    const d = parseFromContext(ctx)
    mylog(`TRACE ${ctx.message?.message_id}`)

    return h.element.callback(d)
}
import { Do } from 'fp-ts-contrib/lib/Do';
import { BotMessage } from './lib/rendered-messages';
import { ChatRenderer } from './lib/chatrenderer';

function createApp() {
    type AppChatState = ChatState<
        ReturnType<typeof createBotStoreF>,
        Action<State> | undefined
    >

    function applyStoreAction(a: Action<State>) {
        return function (cs: AppChatState) {
            return {
                ...cs,
                store: cs.store.apply(a)
            }
        }
    }

    const chatState = (): AppChatState => {
        return {
            ...emptyChatState(),
            ...createBotStoreF(),
        }
    }

    function getInputHandler(d: ReturnType<typeof createDraftWithImages>) {
        return inputHandlerFHandler(d.inputHandlersF[0])
    }

    function defaultHandler(c: ContextOpt) {
        return pipe(
            Do(O.option)
                .bind('messageId', c.messageId)
                .return(({ messageId }) => {
                    return defaultH(messageId)
                }),
        )
    }

    const defaultH = (messageId: number): ChatAction<
        ReturnType<typeof createBotStoreF>,
        Action<State> | undefined
    > => {
        return async function def(
            ctx, renderer, chat, chatdata
        ) {
            if (!chatdata.inputHandler)
                return

            const cs = chatdata.inputHandler(ctx)

            await renderer.delete(messageId)

            if (!cs)
                return

            return chat.handleEvent(ctx, "updated", applyStoreAction(cs))
        }
    }

    return getApp({
        chatData: chatState,
        renderFunc: genericRenderFunction(
            App, { password: 'a' },
            d => ({ dispatcher: d.dispatcher, ...d.store.state }),
            createDraftWithImages,
            getInputHandler
        ),
        init: async (ctx, renderer, chat, chatdata) => {
            chatdata.store.notify = (a) => chat.handleEvent(ctx, "updated", applyStoreAction(a))
        },
        handleMessage: withContextOpt(
            handlerChain([
                or(startHandler, defaultHandler)
            ])),
        handleAction: async (ctx, renderer, chat, chatdata) => {

            const { action, repliedTo } = contextOpt(ctx)

            const renderedElements = chatdata.renderedElements

            const p = pipe(
                Do(O.option)
                    .bind('repliedTo', repliedTo)
                    .return(({ repliedTo }) => findRepliedTo(renderedElements)(repliedTo))
                , O.chain(O.fromNullable)
                , O.filter((callbackTo): callbackTo is BotMessage => callbackTo.kind === 'BotMessage')
                , O.chain(callbackTo => pipe(action, O.map(action => ({ action, callbackTo }))))
                , O.chainNullableK(({ callbackTo, action }) => callbackTo.input.callback2<Action<State>>(action))
                , O.map(applyStoreAction)
                , O.map(action => chat.handleEvent(ctx, "updated", action))
            )

            if (O.isSome(p)) {
                return p.value
            }
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
            const timer = setInterval(() => store.notify(updateSeconds()), 1000)
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
        return upd({ items: [...s.items, ...Array.isArray(item) ? item : [item]] })(s)
    }

    const onDeleteItem = (item: string | PhotoSize) => (s: State) => {
        return upd({ items: s.items.filter(_ => _ != item) })(s)
    }

    const setStringCandidate = (c?: string) => (s: State) => upd({ stringCandidate: c })(s)

    return {
        store,
        dispatcher: {
            onSetVisible,
            onAddItem,
            onSetSecondsLeft,
            onDeleteItem,
            setStringCandidate
        }
    }

}

class StoreF<S> {
    state: S
    constructor(initial: S) {
        this.state = { ...initial }
    }

    public notify = (a: Action<S>) => { mylog("set notify function"); }

    apply(f: (u: S) => S) {
        const n = new StoreF(f(this.state))
        return n
    }
}

function createStoreF<S>(initial: S) {
    return {
        store: new StoreF(initial)
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
        // grep('handleAction'),
        // grep('QueuedChatHandler'),
        // grep('onSetSecondsLeft'),
        // grep('TRACE'),
        // grep('queue'),
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