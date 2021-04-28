import { StackFrame } from "stacktrace-js"
import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { Application, ChatState, createChatHandlerFactory, createRenderFunction, defaultRenderFunction, defaultRenderFunction2, defaultRenderScheme, emptyChatState, fromSource, func2, getApp, getUserMessages } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"
import { Component, connected4 } from "./lib/component"
import { createDraftWithImages } from "./lib/draft"
import { button, message, messagePart, nextMessage } from "./lib/elements-constructors"
import { getActionHandler, getInputHandler, modifyRenderedElements } from "./lib/inputhandler"
import { initLogging, mylog } from "./lib/logging"
import { token } from "./telegram-token.json";
import { defaultActionToChatAction, extendDefaultReducer, flushMatcher, runBefore, storeReducer } from "./lib/reducer"
import * as CA from './lib/chatactions';
import { AppActionsFlatten, Flatten, GetAllBasics, GetAllInputHandlers } from "./lib/types-util"
import { RenderDraft } from "./lib/elements-to-messages"
import { GetSetState, InputHandlerElement } from "./lib/elements"
import { RenderedUserMessage, UserMessageElement } from "./lib/usermessage"
import * as A from 'fp-ts/lib/Array'
import { action, caseText, ifTrue, inputHandler, Matcher2, on } from "./lib/input"
import { append, flush } from "./bot3/util"
import { addErrorLoggingToSchema } from "apollo-server"
import { pipe } from "fp-ts/lib/pipeable"
import { storeAction, StoreAction, storef, StoreF } from "./lib/storeF"
import { Lens } from "monocle-ts"
import { getTrackingRenderer } from "./lib/chatrenderer"
import { createDatabase, LevelTracker } from "./bot3/leveltracker"
import { attachAppToBot } from "./lib/util"

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
        chatDataFactory: () => emptyChatState({
            store: storef<StoreState>({ lists: [] })
        }),
        init: CA.fromList([cleanChatAction]),
        renderFunc: defaultRenderFunction2({
            app: App,
            gc: createAppContext,
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

    const bot = attachAppToBot(new Telegraf(token), createApp)

    mylog('Starting...')

    await bot.launch()

    mylog('Started...')
}

main()