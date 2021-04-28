import { StackFrame } from "stacktrace-js"
import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { Application, ChatState, createChatHandlerFactory, defaultRenderFunction, defaultRenderFunction2, emptyChatState, getApp, getUserMessages } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"
import { connected4 } from "./lib/component"
import { createDraftWithImages } from "./lib/draft"
import { button, message, messagePart, nextMessage } from "./lib/elements-constructors"
import { getActionHandler, getInputHandler, modifyRenderedElements } from "./lib/inputhandler"
import { initLogging, mylog } from "./lib/logging"
import { token } from "./telegram-token.json";
import { defaultActionToChatAction, extendDefaultReducer, flushMatcher, runBefore, storeReducer } from "./lib/reducer"
import * as CA from './lib/chatactions';
import { AppActionsFlatten } from "./lib/types-util"
import { RenderDraft } from "./lib/elements-to-messages"
import { GetSetState } from "./lib/elements"
import { RenderedUserMessage, UserMessageElement } from "./lib/usermessage"
import * as A from 'fp-ts/lib/Array'
import { action, caseText, inputHandler, on } from "./lib/input"
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

const App = connected4(
    (s: Context) => s,
    function* App(
        ctx, props, {
            getState, setStateF
        }: GetSetState<{
            isCreatingList: boolean,
            list: string[]
        }>
    ) {

        const { isCreatingList, list, lenses } = getState({ isCreatingList: false, list: [] })

        const addItem = (item: string) => setStateF(lenses.list.modify(append(item)))
        const addList = () => [
            setStateF(lenses.isCreatingList.set(false)),
            ctx.store.addList(list),
            setStateF(lenses.list.set([]))
        ]

        if (isCreatingList) {
            yield message('make a list:')

            yield inputHandler([
                on(caseText, action(({ messageText }) => addItem(messageText)))
            ])

            for (const m of ctx.userMessages) {
                yield new UserMessageElement(m)
            }

            if (ctx.userMessages.length) {
                yield message("finished?")
                yield button("Yes", addList)
            }
        }
        else {
            yield message('hello')
            yield nextMessage()

            for (const list of ctx.store.lists) {
                for (const item of list) {
                    yield messagePart(item)
                }
                yield nextMessage()
            }

            if (ctx.store.lists.length)
                yield button('reset lists', () => [
                    ctx.store.reset()
                ])

            yield button('create a list', () => setStateF(lenses.isCreatingList.set(true)))
        }
    }
)

function createApp() {

    type MyState = {
        store: StoreF<StoreState>
    }

    type AppAction = AppActionsFlatten<typeof App>
    type AppChatState = ChatState<MyState, AppAction>

    const getContext = (c: AppChatState) => ({
        userMessages: getUserMessages(c),
        store: {
            addList: storeAction((list: string[]) => c.store.lens().lists.modify(append(list))),
            reset: storeAction(() => c.store.lens().lists.set([])),
            lists: c.store.state.lists
        }
    })

    const { renderer, saveToTrackerAction: saveToTracker, cleanChat, tracker } = getTrackingRenderer(
        LevelTracker(createDatabase('./mydb_bot4'))
    )

    return getApp<MyState, AppAction>({
        renderer,
        chatDataFactory: () => emptyChatState({
            store: storef<StoreState>({ lists: [] })
        }),
        init: async ({ tctx, renderer, chatdata }) => {
            await cleanChat(tctx.chat?.id!)(renderer)
            return chatdata 
        },
        renderFunc: defaultRenderFunction2({
            app: App,
            props: {},
            gc: getContext
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
        handleMessage: CA.fromList([CA.addRenderedUserMessage(), saveToTracker, CA.applyInputHandler(), CA.render]),
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