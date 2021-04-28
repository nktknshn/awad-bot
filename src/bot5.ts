import { pipe } from "fp-ts/lib/pipeable"
import Telegraf from "telegraf"
import { createDatabase, LevelTracker } from "./bot3/leveltracker"
import { append, flush } from "./bot3/util"
import * as CA from './lib/chatactions'
import { ChatState, createChatState, getApp, getUserMessages, renderComponent } from "./lib/chathandler"
import { getTrackingRenderer } from "./lib/chatrenderer"
import { Component, connected4 } from "./lib/component"
import { GetSetState } from "./lib/elements"
import { message, messagePart, nextMessage } from "./lib/elements-constructors"
import { action, caseText, ifTrue, inputHandler, on } from "./lib/input"
import { modifyRenderedElements } from "./lib/inputhandler"
import { initLogging, mylog } from "./lib/logging"
import { extendDefaultReducer, flushMatcher, runBefore, storeReducer } from "./lib/reducer"
import { storeAction, StoreAction, storef, StoreF } from "./lib/storeF"
import { AppActionsFlatten } from "./lib/types-util"
import { attachAppToBot } from "./lib/util"
import { token } from "./telegram-token.json"

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
}

const caseTextEqual = (text: string) => on(caseText, ifTrue(({ messageText }) => messageText == text))

const Greeting = Component(
    function* () {
        yield messagePart('Привет')
        yield messagePart('Комманды:')
        yield messagePart('/get')
        yield messagePart('/set')
        yield nextMessage()
    }
)

const App = connected4(
    (s: Context) => s,
    function* (
        ctx, props,
        { getState, setStateF }: GetSetState<{ path: string }>
    ) {

        const { path, lenses } = getState({ path: '/main' })

        yield inputHandler([
            on(caseTextEqual('/start'), action(c => [
                setStateF(lenses.path.set('/main')),
                flush()
            ])),
            on(caseTextEqual('/main'), action(c => [
                setStateF(lenses.path.set('/main')),
                flush()
            ])),
            on(caseTextEqual('/get'), action(c => [
                setStateF(lenses.path.set('/get')),
                flush()
            ])),
            on(caseTextEqual('/set'), action(c => [
                setStateF(lenses.path.set('/set')),
                flush()
            ])),

        ])

        if (path == '/main') {
            yield Greeting({})
        }
        else if (path == '/set') {
            yield message('set here')
            yield message('/main')
        }
        else if (path == '/get') {
            yield message('get here')
            yield message('/main')
        }
    }
)


function createApp() {

    type MyState = {
        store: StoreF<StoreState>
    }

    type AppAction = AppActionsFlatten<typeof App>
    type AppChatState = ChatState<MyState, AppAction>

    const createAppContext = (c: AppChatState) => ({
        userMessages: getUserMessages(c),
        store: {
            addList: storeAction((list: string[]) => c.store.lens().lists.modify(append(list))),
            reset: storeAction(() => c.store.lens().lists.set([])),
            lists: c.store.state.lists
        }
    })

    const { renderer, saveToTrackerAction, cleanChatAction } = getTrackingRenderer(
        LevelTracker(createDatabase('./mydb_bot5'))
    )

    return getApp<MyState, AppAction>({
        renderer,
        chatDataFactory: () => createChatState({
            store: storef<StoreState>({ lists: [] })
        }),
        init: CA.fromList([cleanChatAction]),
        renderFunc: renderComponent({
            component: App,
            contextCreator: createAppContext,
            props: {}
        }),
        actionReducer: extendDefaultReducer(
            runBefore(
                flushMatcher(),
                async ({ chatdata }) => {
                    return pipe(
                        chatdata,
                        modifyRenderedElements(_ => [])
                    )
                }
            ),
            storeReducer()
        ),
        handleMessage: CA.fromList([CA.addRenderedUserMessage(), saveToTrackerAction, CA.applyInputHandler(), CA.render]),
        handleAction: CA.fromList([CA.applyActionHandler(), CA.replyCallback, CA.render])
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