import { select } from "Libstate"
import { Lens } from "monocle-ts"
import { append } from "../bot3/util"
import { ChatState, createChatState, getApp, renderComponent } from "../lib/application"
import * as CA from '../lib/chatactions'
import { withUserMessages } from "../lib/context"
import { applyActionEvent, applyActionEventReducer, ApplyActionsEvent, makeEventReducer } from "../lib/event"
import { extendDefaultReducer, storeReducer } from "../lib/reducer"
import { storeAction, storef, StoreF } from "../lib/storeF"
import { AppActionsFlatten } from "../lib/types-util"
import { App } from './app'

export type Context = ReturnType<typeof contextCreator>
export type StoreState = {
    lists: string[][]
}

type AppAction = AppActionsFlatten<typeof App>
type AppChatState = ChatState<AppState, AppAction>

const withStore = ({ store }: { store: StoreF<StoreState> }) => ({
    store: {
        actions: {
            addList: storeAction(
                (list: string[]) => store.lens().lists.modify(append(list))
            ),
            reset: storeAction(
                () => store.lens().lists.set([])
            ),
        },
        state: store.state
    }
})

const contextCreator = select(
    withUserMessages,
    withStore,
    ({ userId }: { userId: number }) => ({ userId })
)

type AppEvents = ApplyActionsEvent<AppState, AppAction, AppEvents>

type AppState = {
    store: StoreF<StoreState>,
    userId: number,
    doFlush: boolean
    deferredRenderTimer?: NodeJS.Timeout,
    deferRender: number,
    bufferedInputEnabled: boolean
}

const bufferEnabledLens = Lens.fromProp<AppChatState>()('bufferedInputEnabled')

export const createApp = () =>
    getApp<AppState, AppAction, AppEvents>({
        chatStateFactory: (ctx) => createChatState({
            store: storef<StoreState>({ lists: [] }),
            userId: ctx.from?.id!,
            doFlush: true,
            deferRender: 1000,
            bufferedInputEnabled: false
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
            CA.chatState(({ deferRender, bufferedInputEnabled }) =>
                bufferedInputEnabled
                    ? CA.scheduleEvent(
                        deferRender,
                        applyActionEvent([
                            CA.render,
                            CA.mapState(s => bufferEnabledLens.set(false)(s)),
                            CA.chatState(c => c.doFlush ? CA.flush : CA.nothing)
                        ]))
                    : CA.sequence([
                        CA.render,
                        CA.chatState(c => c.doFlush ? CA.flush : CA.nothing)
                    ])
            ),
        ]),
        handleAction: CA.sequence([
            CA.applyActionHandler,
            CA.replyCallback,
            CA.applyEffects,
            CA.render,
            CA.chatState(c => c.doFlush ? CA.flush : CA.nothing),
        ]),
        handleEvent: makeEventReducer(applyActionEventReducer())
    })

