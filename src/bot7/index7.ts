import { AwadServices, userDtoFromCtx } from "bot2/services"
import { AwadStore, createAwadStore } from "bot2/store"
import { updateUser } from "bot2/store/user"
import { storeToDispatch } from "bot2/storeToDispatch"
import { levelDatabase, levelTracker } from "bot3/leveltracker"
import { getDispatcher } from "bot3/store"
import { Bot5StoreState } from "bot5/store"
import * as F from 'fp-ts/lib/function'
import {
    application, ChatState, createChatState, createChatState2, defaultRenderScheme,
    genericRenderComponent
} from "Lib/application"
import * as CA from 'Lib/chatactions'
import { getTrackingRendererE } from "Lib/chatrenderer"
import { connected } from "Lib/component"
import { mapContext as withContext } from "Lib/context"
import { button, message, nextMessage } from "Lib/elements-constructors"
import {
    applyActionEventReducer, ApplyActionsEvent,
    createActionEvent,
    makeEventReducer,
    renderEvent
} from "Lib/event"
import { clearChat } from "Lib/inputhandler"
import {
    chatstateAction,
    composeReducers,
    extendDefaultReducer, flushReducer, reducer, storeReducer
} from "Lib/reducer"
import { select } from "Lib/state"
import { ComposeStores, composeStores, storef } from "Lib/storeF"
import { AppActions, ComponentTypes } from "Lib/types-util"
import { App as App2 } from '../bot2/app'
import { App as App3 } from '../bot3/app'
import { App as App5 } from '../bot5/app'

import { Bot3StoreState, store as store3 } from '../bot3/index3'
import { contextCreatorBot5, store as store5 } from '../bot5/index5'
import PinnedCards from "bot2/connected/PinnedCards"
import { flushState, FlushState, setBufferedInputEnabled } from "Lib/components/actions/flush"
import { bot2Reducers } from "bot2/index2"
import { TelegrafContext } from "telegraf/typings/context"

type ActiveApp = 'app5' | 'app3f' | 'app2'

export const setActiveApp = (activeApp?: ActiveApp) =>
    chatstateAction<{ activeApp?: ActiveApp }>(s =>
        ({ ...s, activeApp })
    )

const App = connected(
    select<{ activeApp?: ActiveApp }>(
        c => ({ activeApp: c.activeApp }),
    ),

    function* ({ activeApp }) {
        yield withContext('bot2', PinnedCards({}))

        yield nextMessage()

        yield message(`hi ${activeApp}`)

        yield button('app3f', () => [
            setActiveApp('app3f')
        ])

        yield button('app5', () => [
            setActiveApp('app5')
        ])

        yield button('app2', () => [
            setActiveApp('app2')
        ])

        yield nextMessage()

        if (activeApp === 'app5') {
            yield withContext('bot5', App5({}))
        }
        else if (activeApp === 'app3f') {
            yield withContext('bot3', App3({ password: 'a' }))
        }
        else if (activeApp === 'app2') {
            yield withContext('bot2', App2({ showPinned: false }))
        }
    }
)

type AT = ComponentTypes<typeof App>

type AppAction = AT['actions']
type AppContext = AT['context']

type AppEvents = ApplyActionsEvent<AppState, AppAction, AppEvents>

type AppState = {
    userId: number,
    activeApp?: 'app5' | 'app3f',
    store: ComposeStores<Bot3StoreState, Bot5StoreState>,
    // store: ComposeStores<typeof store3['state'], typeof store5['state']>,
    bot2Store: AwadStore
} & FlushState

const { renderer, saveToTrackerAction, cleanChatAction,
    untrackRendererElementsAction } = getTrackingRendererE(
        levelTracker(levelDatabase('./mydb_bot7'))
    )

const userId = async (tctx: TelegrafContext) => ({
    userId: tctx.from?.id!,
})

const contextCreator = (cs: ChatState<AppState, AppAction>) => ({
    error: cs.error,
    activeApp: cs.activeApp,
    bot3: {
        dispatcher: getDispatcher(cs.store),
        ...cs.store.state,
    },
    bot5: contextCreatorBot5(cs),
    bot2: ({
        ...cs.bot2Store.getState(),
        dispatcher: storeToDispatch(cs.bot2Store)
    })
})

export const createApp = (services: AwadServices) =>
    application<AppState, AppAction, AppEvents>({
        chatStateFactory:
            createChatState2(
                [flushState({ deferRender: 300 }), userId],
                {
                    store: composeStores([store3, store5]),
                    bot2Store: createAwadStore(services)
                }),
        renderer,
        actionReducer: extendDefaultReducer(
            flushReducer(CA.doNothing),
            storeReducer('store'),
            bot2Reducers()
        ),
        renderFunc: genericRenderComponent(
            defaultRenderScheme(),
            {
                component: App,
                contextCreator,
                props: {}
            }),
        init: CA.sequence([
            cleanChatAction,
            async ({ app, queue, chatdata, tctx }) => {
                const user = await services.getOrCreateUser(userDtoFromCtx(tctx))

                chatdata.bot2Store.subscribe(() =>
                    queue.handleEvent(tctx)(renderEvent()))

                chatdata.bot2Store.dispatch(updateUser(user))

                return {
                    ...chatdata,
                    store: chatdata.store.withDispatch(
                        F.flow(
                            app.actionReducer,
                            createActionEvent,
                            queue.handleEvent()
                        )
                    )
                }
            }
        ]),
        handleMessage:
            CA.branchHandler([
                [CA.ifTextEqual('/start'),
                [
                    CA.addRenderedUserMessage(), clearChat, CA.render],
                [
                    CA.applyInputHandler,
                    saveToTrackerAction,
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
                                    CA.mapState(s => 
                                        setBufferedInputEnabled(!s.bufferedOnce).f(s)
                                    ),
                                    CA.chatState(
                                        c => c.doFlush ? CA.flush : CA.doNothing)
                                ]))
                            : CA.sequence([
                                CA.render,
                                CA.chatState(c => c.doFlush ? CA.flush : CA.doNothing)
                            ])
                    )
                ]]
            ]),
        handleAction: CA.sequence([
            CA.applyActionHandler,
            CA.replyCallback,
            CA.applyEffects,
            CA.render,
            CA.chatState(c => c.doFlush ? CA.flush : CA.doNothing),
        ]),
        handleEvent: makeEventReducer(
            composeReducers(
                applyActionEventReducer(),
            )
        ),
    })