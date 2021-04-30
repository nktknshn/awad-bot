import { combineSelectors, select, Selector } from "Libstate"
import { append } from "../bot3/util"
import { ChatState, createChatState, getApp, renderComponent } from "../lib/application"
import * as CA from '../lib/chatactions'
import { extendDefaultReducer, flushReducer, storeReducer } from "../lib/reducer"
import { storeAction, storef, StoreF } from "../lib/storeF"
import { AppActionsFlatten } from "../lib/types-util"
import { App } from './app'
import { withUserMessages } from "../lib/context"

export type Context = ReturnType<typeof contextCreator>
export type StoreState = {
    lists: string[][]
}

type MyState = {
    store: StoreF<StoreState>,
    userId: number,
    doFlush: boolean
}

type AppAction = AppActionsFlatten<typeof App>
type AppChatState = ChatState<MyState, AppAction>

const withStore = ({ store: { state, lens } }: { store: StoreF<StoreState> }) => ({
    store: {
        actions: {
            addList: storeAction(
                (list: string[]) => lens().lists.modify(append(list))
            ),
            reset: storeAction(
                () => lens().lists.set([])
            ),
        },
        state
    }
})

const contextCreator = select(
    withUserMessages,
    withStore,
    ({ userId }: { userId: number }) => ({ userId })
)

export const createApp = () =>
    getApp<MyState, AppAction>({
        chatDataFactory: (ctx) => createChatState({
            store: storef<StoreState>({ lists: [] }),
            userId: ctx.from?.id!,
            doFlush: true
        }),
        renderFunc: renderComponent({
            component: App,
            contextCreator,
            props: {}
        }),
        init: CA.sequence([]),
        actionReducer:
            extendDefaultReducer(
                storeReducer()
            ),
        handleMessage: CA.sequence([
            CA.applyInputHandler,
            CA.chatState(c => c.doFlush ? CA.nothing : CA.addRenderedUserMessage()),
            CA.applyEffects,
            CA.render,
            CA.chatState(c => c.doFlush ? CA.flush : CA.nothing),
        ]),
        handleAction: CA.sequence([
            CA.applyActionHandler,
            CA.replyCallback,
            CA.applyEffects,
            CA.render,
            CA.chatState(c => c.doFlush ? CA.flush : CA.nothing),
        ])
    })

