import { pipe } from "fp-ts/lib/pipeable"
import Telegraf from "telegraf"
import { createDatabase, LevelTracker } from "./bot3/leveltracker"
import { append } from "./bot3/util"
import * as CA from './lib/chatactions'
import { ChatState, createChatState, getApp, getUserMessages, renderComponent } from "./lib/chathandler"
import { getTrackingRenderer } from "./lib/chatrenderer"
import { connected4 } from "./lib/component"
import { GetSetState } from "./lib/elements"
import { button, message, messagePart, nextMessage } from "./lib/elements-constructors"
import { action, caseText, inputHandler, on } from "./lib/input"
import { modifyRenderedElements } from "./lib/inputhandler"
import { initLogging, mylog } from "./lib/logging"
import { extendDefaultReducer, flushMatcher, runBefore, storeReducer } from "./lib/reducer"
import { storeAction, StoreAction, storef, StoreF } from "./lib/storeF"
import { AppActionsFlatten } from "./lib/types-util"
import { UserMessageElement } from "./lib/usermessage"
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

const App = connected4(
    (s: Context) => s,
    function* App(
        ctx, props,
        { getState, setStateF }: GetSetState<{
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

    const { renderer, saveToTrackerAction: saveToTracker, cleanChatAction, tracker } = getTrackingRenderer(
        LevelTracker(createDatabase('./mydb_bot4'))
    )

    return getApp<MyState, AppAction>({
        renderer,
        chatDataFactory: () => createChatState({
            store: storef<StoreState>({ lists: [] })
        }),
        init: CA.fromList([cleanChatAction]),
        renderFunc: renderComponent({
            component: App,
            props: {},
            contextCreator: getContext
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