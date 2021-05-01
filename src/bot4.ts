import { pipe } from "fp-ts/lib/pipeable"
import Telegraf from "telegraf"
import { levelDatabase, levelTracker } from "./bot3/leveltracker"
import { append, flush } from "./bot3/util"
import * as CA from './lib/chatactions'
import { ChatState, createChatState, getApp, getUserMessages, renderComponent } from "./lib/application"
import { getTrackingRenderer } from "./lib/chatrenderer"
import { connected } from "./lib/component"
import { button, message, messagePart, nextMessage } from "./lib/elements-constructors"
import { action, caseText, inputHandler, on } from "./lib/input"
import { modifyRenderedElements } from "./lib/inputhandler"
import { initLogging, mylog } from "./lib/logging"
import { extendDefaultReducer, flushReducer, runBefore, storeReducer } from "./lib/reducer"
import { storeAction, StoreAction, storef, StoreF } from "./lib/storeF"
import { AppActionsFlatten } from "./lib/types-util"
import { UserMessageElement } from "./lib/usermessage"
import { attachAppToBot } from "./lib/util"
import { token } from "./telegram-token.json"
import { GetSetState } from "Libtree2"
import { select } from "Libstate"
import { identity } from "fp-ts/lib/function"

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

const App = connected(
    select(({ store, userMessages }: Context) => ({ store, userMessages })),
    function* App(
        ctx, props,
        { getState, setState }: GetSetState<{
            isCreatingList: boolean,
            list: string[]
        }>
    ) {

        const { isCreatingList, list, lenses } = getState({ isCreatingList: false, list: [] })

        const addItem = (item: string) => setState(lenses.list.modify(append(item)))
        const addList = () => [
            setState(lenses.isCreatingList.set(false)),
            ctx.store.addList(list),
            setState(lenses.list.set([])),
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

            yield button('create a list', () => setState(lenses.isCreatingList.set(true)))
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
        levelTracker(levelDatabase('./mydb_bot4'))
    )

    return getApp<MyState, AppAction>({
        renderer,
        chatStateFactory: () => createChatState({
            store: storef<StoreState>({ lists: [] })
        }),
        init: CA.sequence([cleanChatAction]),
        renderFunc: renderComponent({
            component: App,
            props: {},
            contextCreator: getContext
        }),
        actionReducer: extendDefaultReducer(
            flushReducer(async ({ chatdata }) => {
                return pipe(
                    chatdata,
                    modifyRenderedElements(_ => [])
                )
            }),
            storeReducer()
        ),
        handleMessage: CA.sequence([CA.addRenderedUserMessage(), saveToTracker, CA.applyInputHandler, CA.render]),
        handleAction: CA.sequence([CA.applyActionHandler, CA.replyCallback, CA.render])
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