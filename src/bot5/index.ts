import { combineSelectors, select, Selector } from "Libstate"
import { append } from "../bot3/util"
import { ChatState, createChatState, getApp, renderComponent } from "../lib/application"
import * as CA from '../lib/chatactions'
import { ChatActionReducer, extendDefaultReducer, flushReducer, reducer, reducerToFunction, storeReducer } from "../lib/reducer"
import { storeAction, storef, StoreF } from "../lib/storeF"
import { AppActions, AppActionsFlatten } from "../lib/types-util"
import { App } from './app'
import { withUserMessages } from "../lib/context"
import { Lens } from "monocle-ts"
import { ChatActionContext } from "../lib/chatactions"
import { Reducer } from "redux"

export type Context = ReturnType<typeof contextCreator>
export type StoreState = {
    lists: string[][]
}


type AppAction = AppActionsFlatten<typeof App>
type AppChatState = ChatState<MyState, AppAction>

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

interface ApplyActionsEvent<R, H, E> {
    kind: 'apply-actions-event',
    actions: CA.AppChatAction<R, H, E>[]
}

function applyActionEvent<R, H, E>(
    actions: CA.AppChatAction<R, H, E>[]
): ApplyActionsEvent<R, H, E> {
    return {
        kind: 'apply-actions-event',
        actions
    }
}

type AppEvents = ApplyActionsEvent<MyState, AppAction, AppEvents>

const bufferEnabledLens = Lens.fromProp<AppChatState>()('bufferedInputEnabled')

const applyActionEventReducer = <R, H, E>() => reducer(
    (event: ApplyActionsEvent<R, H, E> | any): event is ApplyActionsEvent<R, H, E> =>
        event.kind === 'apply-actions-event',
    event => async (ctx: CA.ChatActionContext<R, H, E>) => {
        return ctx.app.renderFunc(
            await CA.sequence(event.actions)(ctx)
        ).renderFunction(ctx.renderer)
    }
)

function makeEventReducer<R, H, E>(
    reducer: ChatActionReducer<E, R, H, E>
): (
        ctx: ChatActionContext<R, H, E>,
        event: E
    ) => Promise<ChatState<R, H>> {
    return async (ctx, event) => {
        return await CA.sequence(
            reducerToFunction(
                reducer
            )(event))(ctx)
    }
}

type MyState = {
    store: StoreF<StoreState>,
    userId: number,
    doFlush: boolean
    deferredRenderTimer?: NodeJS.Timeout,
    deferRender: number,
    bufferedInputEnabled: boolean
}


export const createApp = () =>
    getApp<MyState, AppAction, AppEvents>({
        chatStateFactory: (ctx) => createChatState({
            store: storef<StoreState>({ lists: [] }),
            userId: ctx.from?.id!,
            doFlush: true,
            deferRender: 0,
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
            CA.chatState(c =>
                c.bufferedInputEnabled
                    ? CA.scheduleEvent(
                        c.deferRender,
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

