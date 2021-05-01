import { select } from "Libstate"
import { Lens } from "monocle-ts"
import { append } from "../bot3/util"
import { ChatState, createChatState, getApp, renderComponent }
    from "../lib/application"
import * as CA from '../lib/chatactions'
import { withUserMessages } from "../lib/context"
import {
    applyActionEvent, applyActionEventReducer, ApplyActionsEvent,
    makeEventReducer
} from "../lib/event"
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
type AppEvents = ApplyActionsEvent<AppState, AppAction, AppEvents>

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

type AppState = {
    store: StoreF<StoreState>,
    userId: number,
    doFlush: boolean
    deferredRenderTimer?: NodeJS.Timeout,
    deferRender: number,
    bufferedInputEnabled: boolean,
    bufferedOnce: boolean
}

const bufferEnabledLens = Lens.fromProp<AppChatState>()('bufferedInputEnabled')

export const createApp = () =>
    getApp<AppState, AppAction, AppEvents>({
        chatStateFactory: (ctx) => createChatState({
            store: storef<StoreState>({ lists: [] }),
            userId: ctx.from?.id!,
            doFlush: true,
            deferRender: 1500,
            bufferedInputEnabled: false,
            bufferedOnce: false
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
            CA.chatState(c => c.doFlush
                ? CA.doNothing
                : CA.addRenderedUserMessage()),
            CA.applyEffects,
            CA.chatState(({ deferRender, bufferedInputEnabled }) =>
                bufferedInputEnabled
                    ? CA.scheduleEvent(
                        deferRender,
                        applyActionEvent([
                            CA.render,
                            CA.mapState(s => bufferEnabledLens.set(
                                !s.bufferedOnce
                            )(s)),
                            CA.chatState(
                                c => c.doFlush ? CA.flush : CA.doNothing)
                        ]))
                    : CA.sequence([
                        CA.render,
                        CA.chatState(c => c.doFlush ? CA.flush : CA.doNothing)
                    ])
            ),
        ]),
        handleAction: CA.sequence([
            CA.applyActionHandler,
            CA.replyCallback,
            CA.applyEffects,
            CA.render,
            CA.chatState(c => c.doFlush ? CA.flush : CA.doNothing),
        ]),
        handleEvent: makeEventReducer(applyActionEventReducer())
    })

