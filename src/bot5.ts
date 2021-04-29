import { pipe } from "fp-ts/lib/pipeable"
import Telegraf from "telegraf"
import { levelDatabase, levelTracker } from "./bot3/leveltracker"
import { append, flush } from "./bot3/util"
import * as CA from './lib/chatactions'
import { ChatState, createChatState, getApp, getUserMessages, renderComponent } from "./lib/application"
import { getTrackingRenderer } from "./lib/chatrenderer"
import { Component, ComponentElement, ComponentGenerator, connected4 } from "./lib/component"
import { GetSetState, LocalStateAction } from "./lib/elements"
import { button, effect, message, messagePart, nextMessage } from "./lib/elements-constructors"
import { action, caseText, ifTrue, inputHandler, messageText, on } from "./lib/input"
import { modifyRenderedElements } from "./lib/inputhandler"
import { initLogging, mylog } from "./lib/logging"
import { defaultReducer, extendDefaultReducer, flushReducer, reducerToFunction, runBefore, storeReducer } from "./lib/reducer"
import { storeAction, StoreAction, storef, StoreF } from "./lib/storeF"
import { AppActions, AppActionsFlatten, GetAllBasics, GetComps } from "./lib/types-util"
import { attachAppToBot, parsePath } from "./lib/util"
import { token } from "./telegram-token.json"
import { Router, routeMatcher } from "./lib/components/router"
import * as O from 'fp-ts/lib/Option';
import { flow, identity } from "fp-ts/lib/function";
import { Do } from 'fp-ts-contrib/lib/Do';
import { InputHandlerData } from "./lib/messages"
import { ParsedUrlQuery } from "node:querystring"
import { UserMessageElement } from "./lib/usermessage"

type StoreState = {
    lists: string[][]
}

interface Context {
    userMessages: number[],
    store: {
        lists: string[][],
        addList: (list: string[]) => StoreAction<StoreState>;
        reset: () => StoreAction<StoreState>
    };
    userId: number
}

// type Context = Parameters<ReturnType<typeof createApp>['renderFunc']>[0]

const caseTextEqual = (text: string) => on(caseText, ifTrue(({ messageText }) => messageText == text))

const parsePathOpt = (path: string) => pipe(
    parsePath(path),
    ({ pathname, query }) =>
        pipe(O.fromNullable(pathname), O.map(
            path => ({
                path,
                query: pipe(O.fromNullable(query), O.fold(() => ({}), q => ({...q}))),
            })))
)

const Greeting = connected4(
    ({ userId }: Context) => ({ userId }),
    function* (ctx, {
        fromStart
    }: { fromStart: boolean }) {
        if (fromStart)
            yield messagePart(`Привет ${ctx.userId}`)

        yield messagePart('Комманды:')
        yield messagePart('/get')
        yield messagePart('/set')
        yield nextMessage()
    }
)

const Set = connected4(
    ({ userMessages }: Context) => ({ userMessages }),
    function* (
        { userMessages },
        { onDone }: { onDone: (list: string[]) => (StoreAction<StoreState> | LocalStateAction)[] },
        { getState, setStateF }: GetSetState<{
            list: string[]
        }>) {

        const { list, lenses } = getState({ list: [] })

        yield inputHandler([
            on(caseText, action(({ messageText }) =>
                [
                    setStateF(lenses.list.modify(append(messageText))),
                ]
            ))
        ])

        yield effect(() => setDoFlush(false))

        yield message('set here: ')

        for (const m of userMessages) {
            yield new UserMessageElement(m)
        }

        yield message(`list: ${list}`)
        yield button('Done', () => [onDone(list), setDoFlush(true)])
    })

const Get = connected4(
    (c: Context) => c,
    function* (c) {
        yield message('get here')
        yield nextMessage()

        for (const list of c.store.lists) {
            for (const item of list) {
                yield messagePart(item)
            }
            yield nextMessage()
        }

        yield message('/main')
    })

const AppRouter = Router(
    routeMatcher((c: {
        path: string, query: ParsedUrlQuery,
        onDone: (list: string[]) => (StoreAction<StoreState> | LocalStateAction)[]
    }) =>
        c.path == '/main',
        ({ query }) => Greeting({
            fromStart: 'from_start' in query
        })),
    routeMatcher(c => c.path == '/set', ({ onDone }) => Set({ onDone })),
    routeMatcher(c => c.path == '/get', () => Get({})),
    Component(function* () {
        yield message('wrong input')
    })({})
)

const casePath = on(caseText,
    ifTrue(({ messageText }) => messageText.startsWith('/')),
    action(({ messageText }) => parsePath(messageText)),
    O.chain(({ pathname, query }) => pipe(O.fromNullable(pathname), O.map(pathname => ({
        pathname,
        query: pipe(O.fromNullable(query), O.fold(() => ({}), q => q)),
    }))),
    ))

const App = connected4(
    ({ store }: Context) => ({ store }),
    function* (
        { store }, props,
        { getState, setStateF }: GetSetState<{ path: string, query: ParsedUrlQuery }>
    ) {

        const {
            path, query,
            lenses: { path: pathLens, query: queryLens }
        } = getState({ path: '/main', query: {} })

        yield inputHandler([
            on(caseText,
                ifTrue(({ messageText }) => messageText.startsWith('/start')),
                action(c => [
                    setStateF(pathLens.set('/main?from_start=1')),
                ])),
            on(caseText,
                action(({ messageText }) => [
                    setStateF(pathLens.set(messageText)),
                ])),
        ])

        yield pipe(
            parsePathOpt(path)
            , O.fold(
                () => AppRouter({ path: '/error', query: {}, onDone: () => [] }),
                props => AppRouter({
                    ...props,
                    onDone:
                        list => [
                            store.addList(list), 
                            setStateF(pathLens.set('/main'))
                        ]
                })
            )
        )
    }
)


const setDoFlush = (doFlush: boolean) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { doFlush: boolean }>(s: R) =>
        ({ ...s, doFlush })
})


function createApp() {

    type MyState = {
        store: StoreF<StoreState>,
        userId: number,
        doFlush: boolean
    }

    type AppAction = AppActionsFlatten<typeof App>
    type AppChatState = ChatState<MyState, AppAction>

    const { renderer, saveToTrackerAction, cleanChatAction, untrackRendererElementsAction } = getTrackingRenderer(
        levelTracker(levelDatabase('./mydb_bot5'))
    )

    const createAppContext = (c: AppChatState) => ({
        userMessages: getUserMessages(c),
        store: {
            addList: storeAction((list: string[]) => c.store.lens().lists.modify(append(list))),
            reset: storeAction(() => c.store.lens().lists.set([])),
            lists: c.store.state.lists,
        },
        userId: c.userId
    })

    return getApp<MyState, AppAction>({
        // renderer,
        chatDataFactory: (ctx) => createChatState({
            store: storef<StoreState>({ lists: [] }),
            userId: ctx.from?.id!,
            doFlush: true
        }),
        renderFunc: renderComponent({
            component: App,
            contextCreator: createAppContext,
            props: {}
        }),
        init: CA.sequence([cleanChatAction]),
        actionReducer:
            extendDefaultReducer(
                flushReducer(
                    CA.sequence([
                        untrackRendererElementsAction,
                        CA.flushAction,
                    ])),
                storeReducer()
            ),
        handleMessage: CA.sequence([
            CA.applyInputHandler(),
            CA.chatState(c => c.doFlush ? CA.emptyAction : CA.addRenderedUserMessage()),
            CA.applyEffects,
            CA.render,
            CA.chatState(c => c.doFlush ? CA.flushAction : CA.emptyAction),
        ]),
        handleAction: CA.sequence([
            CA.applyActionHandler(),
            CA.replyCallback,
            CA.applyEffects,
            CA.render,
            CA.chatState(c => c.doFlush ? CA.flushAction : CA.emptyAction),
        ])
    })
}


async function main() {
    initLogging([
        () => true
    ])

    const bot = attachAppToBot(new Telegraf(token), createApp())

    mylog('Starting...')

    await bot.launch()

    mylog('Started...')
}

main()