import { append } from "../bot3/util"
import { ChatState, createChatState, getApp, getUserMessages, renderComponent } from "../lib/application"
import * as CA from '../lib/chatactions'
import { extendDefaultReducer, flushReducer, storeReducer } from "../lib/reducer"
import { storeAction, storef, StoreF } from "../lib/storeF"
import { AppActionsFlatten } from "../lib/types-util"
import { App, AppContext } from './app'

type StoreState = {
    lists: string[][]
}

type MyState = {
    store: StoreF<StoreState>,
    userId: number,
    doFlush: boolean
}

type AppAction = AppActionsFlatten<typeof App>
type AppChatState = ChatState<MyState, AppAction>

export function createApp() {
    const createAppContext = (c: AppChatState): AppContext => ({
        userMessages: getUserMessages(c),
        store: {
            addList: storeAction((list: string[]) => c.store.lens().lists.modify(append(list))),
            reset: storeAction(() => c.store.lens().lists.set([])),
            lists: c.store.state.lists,
        },
        userId: c.userId
    })

    return getApp<MyState, AppAction>({
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
        init: CA.sequence([]),
        actionReducer:
            extendDefaultReducer(
                flushReducer(
                    CA.sequence([
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
