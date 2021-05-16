import { startBuild } from "Lib/appbuilder"
import { application, defaultRenderScheme, genericRenderComponent } from "Lib/application"
import * as CA from 'Lib/chatactions'
import { chatState } from "Lib/chatstate"
import { addUserMessageIfNeeded, deferredRender, FlushAction, flushIfNeeded, FlushState, withFlush } from "Lib/components/actions/flush"
import { defaultFlushAction } from "Lib/defaults"
import {
    applyActionEventReducer,
    makeEventReducer
} from "Lib/event"
import { extendDefaultReducer, storeReducer } from "Lib/reducer"
import { select } from "Lib/state"
import { lens, StoreAction, storeAction, storef, StoreF2 } from "Lib/storeF"
import { BasicAppEvent } from "Lib/types-util"
import { TelegrafContext } from "telegraf/typings/context"
import { append } from "../bot3/util"
import { withUserMessages } from "../lib/context"
import { App } from './app'

export type Context = ReturnType<typeof contextCreatorBot5>
export type Bot5StoreState = {
    lists: string[][]
}

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

export const store = () => storef<Bot5StoreState>({ lists: [] })

const userId = async (tctx: TelegrafContext) => ({
    userId: tctx.from?.id!,
})

const handleMessage = <R extends FlushState & FlushAction, H>() =>
    CA.sequence<R, H, BasicAppEvent<R, H>>([
        CA.applyInputHandler,
        addUserMessageIfNeeded(),
        CA.applyEffects,
        deferredRender()
    ])

const state = chatState(
    [
        withFlush({ deferRender: 1500 }),
        userId,
        async () => ({ 
            store: store(),
            flushAction: defaultFlushAction
        })
    ])

const app = startBuild(App, state).extend(
    a => ({
        handleMessage: a.actionF(handleMessage)
    })
)

export const createApp = () =>
    application({
        state,
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
        handleMessage: app.ext.handleMessage,
        handleAction: CA.sequence([
            CA.applyActionHandler,
            CA.replyCallback,
            CA.applyEffects,
            CA.render,
            flushIfNeeded(CA.withChatState(s => s.flushAction())),
        ]),
        handleEvent: makeEventReducer(applyActionEventReducer())
    })

