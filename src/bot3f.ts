import * as A from 'fp-ts/lib/Array'
import { Separated } from "fp-ts/lib/Compactable"
import { Predicate, Refinement } from "fp-ts/lib/function"
import { pipe } from "fp-ts/lib/pipeable"
import { StackFrame } from 'stacktrace-js'
import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { PhotoSize } from "telegraf/typings/telegram-types"
import { mediaGroup, PhotoGroupElement, photos } from './bot3/mediagroup'
import { Application, ChatState, createChatHandlerFactory, emptyChatState, genericRenderFunction, getApp } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"
import { connected1, connected4 } from "./lib/component"
import { BasicElement, GetSetState } from "./lib/elements"
import { button, effect, message } from "./lib/elements-constructors"
import { elementsToMessagesAndHandlers, emptyDraft, RenderDraft } from "./lib/elements-to-messages"
import { defaultHandler, handlerChain, or, startHandler, withContextOpt } from "./lib/handler"
import { action, casePhoto, caseText, ifTrue, inputHandler, nextHandler, on } from "./lib/input"
import { initLogging, mylog } from './lib/logging'
import { createStore } from "./lib/store2"
import { token } from "./telegram-token.json"
import { ButtonElementF, buttonF, InputHandlerElementF, InputHandlerF, inputHandlerF } from './lib/handlerF'

type Item = string | PhotoSize

type Context = ReturnType<typeof createBotStoreF>['store']['state'] & {
    dispatcher: ReturnType<typeof createBotStoreF>['dispatcher']
}

type T = {
    <A, B extends A>(refinement: Refinement<A, B>): (fa: Array<A>) => Separated<Array<A>, Array<B>>
    <A>(predicate: Predicate<A>): (fa: Array<A>) => Separated<Array<A>, Array<A>>
}


export const casePassword =
    (password: string) => on(caseText, ifTrue(text => text == password))


const VisibleSecrets = connected4(
    (ctx: Context) => ctx,
    function* (
        { items, secondsLeft, dispatcher: { onDeleteItem, onSetVisible, onSetSecondsLeft } }
    ) {

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
        yield buttonF(`Hide`, () => onSetVisible(false))
        yield buttonF([`More time (${secondsLeft} secs)`, 'more'], () => {
            mylog(`TRACE More time clicked ${secondsLeft} -> onSetSecondsLeft(${secondsLeft + 30})`)
            return onSetSecondsLeft(secondsLeft + 30)
        })
    }
)


const App = connected4(
    (ctx: Context) => ctx,
    function* (
        { isVisible, dispatcher: { onSetVisible, onAddItem } },
        { password }: { password: string },
        { getState, setState }: GetSetState<{
            stringCandidate?: string,
            photoCandidates?: PhotoSize[]
        }>
    ) {

        yield inputHandlerF(
            on(casePassword(password), action(() => onSetVisible(true))),
            on(caseText, action(text => {
                setState({ stringCandidate: text })
                return nextHandler()
            })),
            on(casePhoto, action(photo => {

                const { photoCandidates } = getState({})

                mylog({ photo });
                mylog({ photoCandidates });

                setState({ photoCandidates: [...photoCandidates ?? [], photo[0]] })
                return nextHandler()
            }))
        )

        const { stringCandidate, photoCandidates } = getState({})

        if (isVisible) {
            yield VisibleSecrets({})
        }

        if (stringCandidate) {
            const addItem = () => { setState({ stringCandidate: undefined }); return onAddItem(stringCandidate) }

            const rejectItem = () => { setState({ stringCandidate: undefined }); return undefined }

            if (!isVisible) {
                yield message(`Add '${stringCandidate}?'`)
                // yield buttonF(`Yes`, addItem)
                // yield buttonF(`No`, rejectItem)
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
                // yield buttonF(`Yes`, addItem)
                // yield buttonF(`No`, rejectItem)

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
    elements: (BasicElement | PhotoGroupElement | InputHandlerElementF<any>)[]
): RenderDraft {
    const draft = emptyDraft()

    function handle(compel: BasicElement | PhotoGroupElement | InputHandlerElementF<any>) {
        if (compel.kind === 'PhotoGroupElement') {
            mediaGroup.appendDraft(draft, compel)
        }
        else if (compel.kind === 'InputHandlerElementF') {
            draft.inputHandlersF.push(new InputHandlerF(compel))
        }
        // else if (compel.kind === 'ButtonElementF') {
        //     mediaGroup.appendDraft(draft, compel)
        // }
        else {
            elementsToMessagesAndHandlers(compel, draft)
        }
    }

    for (const compel of elements) {
        handle(compel)
    }

    return draft
}

function createApp() {

    const chatState = (): ChatState<ReturnType<typeof createBotStoreF>> => {
        return {
            treeState: {},
            renderedElements: [],
            inputHandler: ctx => function () { return a => a},
            actionHandler: async function () { },
            ...createBotStoreF()
        }
    }

    return getApp({
        chatData: chatState,
        renderFunc: genericRenderFunction(
            App, { password: 'a' },
            (d) => ({ dispatcher: d.dispatcher, ...d.store.state }),
            createDraftWithImages
        ),
        init: async (ctx, renderer, chat, chatdata) => {
            // chatdata.store.subscribe(() => chat.handleEvent(ctx, "updated"))
        },
        handleMessage: withContextOpt(
            handlerChain([
                or(startHandler, defaultHandler)
            ]))
    })
}

type State = {
    isVisible: boolean,
    items: (string | PhotoSize)[],
    secondsLeft: number,
    timer: NodeJS.Timeout | undefined
}

interface ActionF<S> {
    (s: S): S
}

type ActionG<S> = (s: S) => Generator<Action<S>>

type Action<S> = ActionF<S>
// | ActionG<S>

class StoreF<S> {
    state: S
    constructor(initial: S) {
        this.state = { ...initial }
    }

    public notify = (a: Action<S>) => { mylog("set notify function"); }

    apply(f: (u: S) => S) {
        return new StoreF(f(this.state))
    }

    applyg(g: Generator<(u: S) => S>) {

        let s: StoreF<S> = this
        for (const f of g) {
            s = new StoreF(f(s.state))
        }
        return s
    }
    dispatch(f: Action<S>) {
        function isGenerator(fn: any): fn is Generator<(u: S) => S> {
            return fn.constructor.name === 'GeneratorFunction';
        }

        function isFunction(fn: any): fn is (u: S) => S {
            return fn.constructor.name === 'Function';
        }

        if (isGenerator(f)) {
            return this.applyg(f)
        }
        else if (isFunction(f)) {
            return this.apply(f)
        }
    }
}


const dispatch = <S>(f: Action<S>) => (s: StoreF<S>) => {
    function isGenerator(fn: any): fn is Generator<(u: S) => S> {
        return fn.constructor.name === 'GeneratorFunction';
    }

    function isFunction(fn: any): fn is (u: S) => S {
        return fn.constructor.name === 'Function';
    }

    if (isGenerator(f)) {
        return s.applyg(f)
    }
    else if (isFunction(f)) {
        return s.apply(f)
    }
}

function createStoreF<S>(initial: S) {
    return {
        store: new StoreF(initial)
    }
}

function createBotStoreF() {
    const { store } = createStoreF<State>({
        isVisible: false,
        items: [],
        secondsLeft: 0,
        timer: undefined
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

    return {
        store,
        dispatcher: {
            onSetVisible,
            onAddItem,
            onSetSecondsLeft,
            onDeleteItem
        }
    }

}

function createBotStore() {

    const { store, notify, updateC, getState } = createStore<State>({
        isVisible: false,
        items: [],
        secondsLeft: 0,
        timer: undefined
    })

    const onSetSecondsLeft = async (secondsLeft: number) => {
        mylog(`onSetSecondsLeft(${secondsLeft})`)
        updateC({ secondsLeft })
        await notify()
    }

    const updateSeconds = () => {
        const { secondsLeft } = getState()
        if (secondsLeft > 0)
            onSetSecondsLeft(secondsLeft - 1)
        else
            onSetVisible(false)
    }

    const onSetVisible = async (isVisible: boolean) => {
        updateC({ isVisible })

        if (isVisible) {
            updateC({
                secondsLeft: 15,
                timer: setInterval(updateSeconds, 1000)
            })
        }
        else {
            const { timer } = getState()
            timer && clearInterval(timer)
            updateC({ timer: undefined })
        }

        await notify()
    }

    const onAddItem = async (item: string | PhotoSize[]) => {
        updateC({ items: [...getState().items, ...Array.isArray(item) ? item : [item]] })
        await notify()
    }

    const onDeleteItem = async (item: string | PhotoSize) => {
        updateC({ items: getState().items.filter(_ => _ != item) })
        await notify()
    }

    return {
        store,
        dispatcher: {
            onSetVisible,
            onAddItem,
            onSetSecondsLeft,
            onDeleteItem
        }
    }
}

const byfunc = (fname: string) => (fs: StackFrame[]) => fs[0].functionName ? fs[0].functionName?.indexOf(fname) > -1 : false

const grep = (ss: string) => (s: string, fs: StackFrame[]) => s.indexOf(ss) > -1

async function main() {
    initLogging([
        // byfunc('.renderActions'),
        // byfunc('createChatHandlerFactory'),
        // grep('handleMessage'),
        // grep('handleAction'),
        // grep('QueuedChatHandler'),
        // grep('onSetSecondsLeft'),
        grep('TRACE'),
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