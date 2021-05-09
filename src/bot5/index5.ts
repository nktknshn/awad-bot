import { application, ChatState, createChatState, createChatState2, defaultRenderScheme, genericRenderComponent } from "Lib/application"
import * as CA from 'Lib/chatactions'
import { flushState, FlushState } from "Lib/components/actions/flush"
import {
    applyActionEventReducer, ApplyActionsEvent, createActionEvent,
    makeEventReducer
} from "Lib/event"
import { extendDefaultReducer, storeReducer } from "Lib/reducer"
import { select } from "Lib/state"
import { lens, StoreAction, storeAction, storef, StoreF2 } from "Lib/storeF"
import { AppActionsFlatten } from "Lib/types-util"
import { Lens } from "monocle-ts"
import { TelegrafContext } from "telegraf/typings/context"
import { append } from "../bot3/util"
import { withUserMessages } from "../lib/context"
import { App } from './app'

export type Context = ReturnType<typeof contextCreatorBot5>
export type Bot5StoreState = {
    lists: string[][]
}

type AppType = typeof App

type AppAction = AppActionsFlatten<AppType>
type AppChatState = ChatState<Bot5AppState, AppAction>
type AppEvents = ApplyActionsEvent<Bot5AppState, AppAction, AppEvents>

type Store = StoreF2<Bot5StoreState, StoreAction<Bot5StoreState>>

const withStore = <K extends keyof any>(
    key: K,
) =>
    (s: Record<K, Store>) => ({
        store: {
            actions: {
                addList: storeAction(
                    (list: string[]) => lens(s[key]).lists.modify(append(list))
                ),
                reset: storeAction(
                    () => lens(s[key]).lists.set([])
                ),
            },
            state: s[key].state
        }
    })

export const contextCreatorBot5 = select(
    withUserMessages,
    withStore('store'),
    ({ userId }: { userId: number }) => ({ userId })
)

export const store = storef<Bot5StoreState>({ lists: [] })

export type Bot5AppState = {
    store: Store,
    userId: number,
} & FlushState

export const bufferEnabledLens = Lens.fromProp<AppChatState>()('bufferedInputEnabled')
const userId = async (tctx: TelegrafContext) => ({
    userId: tctx.from?.id!,
})

export const createApp = () =>
    application<Bot5AppState, AppAction, AppEvents>({
        chatStateFactory: createChatState2(
            [flushState({ deferRender: 1500 }), userId], { store }),
        renderFunc: genericRenderComponent(
            defaultRenderScheme(),
            {
                component: App,
                contextCreator: contextCreatorBot5,
                props: {}
            }),
        init: CA.sequence([]),
        actionReducer:
            extendDefaultReducer(
                storeReducer('store')
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
                        createActionEvent([
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

