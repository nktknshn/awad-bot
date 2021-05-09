import PinnedCards from "bot2/connected/PinnedCards"
import { bot2Reducers, contextCreatorBot2, initBot2 } from "bot2/index2"
import { AwadServices } from "bot2/services"
import { createAwadStore } from "bot2/store"
import { levelDatabase, levelTracker } from "bot3/leveltracker"
import {
    application, createChatState, defaultRenderScheme,
    genericRenderComponent
} from "Lib/application"
import * as CA from 'Lib/chatactions'
import { createChatRendererE, getTrackingRendererE, Tracker } from "Lib/chatrenderer"
import { connected } from "Lib/component"
import { addUserMessageIfNeeded, deferredRender, flushIfNeeded, withFlush, FlushState } from "Lib/components/actions/flush"
import { reloadInterface } from "Lib/components/actions/misc"
import { connectFStore } from "Lib/components/actions/store"
import { initTrackingRenderer, saveToTrackerAction, UseTrackingRenderer, useTrackingRenderer } from "Lib/components/actions/tracker"
import { contextFromKey } from "Lib/context"
import { buttonsRow, message, nextMessage } from "Lib/elements-constructors"
import {
    applyActionEventReducer,

    makeEventReducer
} from "Lib/event"
import {
    chatstateAction,
    composeReducers,
    extendDefaultReducer, flushReducer, storeReducer
} from "Lib/reducer"
import { select } from "Lib/state"
import { composeStores } from "Lib/storeF"
import { withState, BasicAppEvent } from "Lib/types-util"
import { TelegrafContext } from "telegraf/typings/context"
import { App as App2 } from '../bot2/app'
import { App as App3 } from '../bot3/app'
import { contextCreatorBot3, store as store3 } from '../bot3/index3'
import { App as App5 } from '../bot5/app'
import { contextCreatorBot5, store as store5 } from '../bot5/index5'


const userId = async (tctx: TelegrafContext) => ({
    userId: tctx.from?.id!,
})

const username = async (tctx: TelegrafContext) => ({
    username: tctx.from?.username,
})


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
        yield contextFromKey('bot2', PinnedCards({}))
        yield nextMessage()
        yield message(`hi ${activeApp}`)

        yield buttonsRow(['app3f', 'app5', 'app2'],
            (_, data) => setActiveApp(data as ActiveApp))

        yield nextMessage()

        if (activeApp === 'app5') {
            yield contextFromKey('bot5', App5({}))
        }
        else if (activeApp === 'app3f') {
            yield contextFromKey('bot3', App3({ password: 'a' }))
        }
        else if (activeApp === 'app2') {
            yield contextFromKey('bot2', App2({ showPinned: false }))
        }
    }
)

// const handleAction = app.actions([
//     CA.applyActionHandler,
//     CA.replyCallback,
//     CA.applyEffects,
//     CA.render,
//     flushIfNeeded(),
// ])
const handleMessage = <R extends FlushState & UseTrackingRenderer, H>() =>
    CA.tctx<R, H, BasicAppEvent<R, H>>(tctx =>
        CA.ifTextEqual('/start')(tctx)
            ? reloadInterface()
            : CA.sequence(
                [
                    CA.applyInputHandler,
                    saveToTrackerAction(),
                    addUserMessageIfNeeded(),
                    CA.applyEffects,
                    deferredRender()
                ]
            )
    )

const constructState = (services: AwadServices) =>
    createChatState(
        [
            withFlush({ deferRender: 1500, bufferedInputEnabled: false }),
            useTrackingRenderer(levelTracker(levelDatabase('./mydb_bot7'))),
            userId,
            async () => ({
                activeApp: undefined as ActiveApp | undefined,
                store: composeStores([store3, store5]),
                bot2Store: createAwadStore(services)
            })
        ],
    )

const app = withState(App)(constructState)
    .extend(
        a => ({
            attachStore: connectFStore(a),
            handleAction: a.actions([
                CA.applyActionHandler,
                CA.replyCallback,
                CA.applyEffects,
                CA.render,
                flushIfNeeded(),
            ]),
            handleEvent: a.eventFunc(
                makeEventReducer(
                    composeReducers(
                        applyActionEventReducer(),
                    )
                )),
            handleMessage: a.actionF(handleMessage),
            init(services: AwadServices) {
                return a.actions([
                    initTrackingRenderer(),
                    this.attachStore,
                    initBot2('bot2Store')(services),
                ])
            },
        })
    )

const contextCreator = app.mapState((cs) => ({
    error: cs.error,
    activeApp: cs.activeApp,
    bot3: contextCreatorBot3(cs),
    bot5: contextCreatorBot5(cs),
    bot2: contextCreatorBot2({
        store: cs.bot2Store
    })
}))

export const createApp = (services: AwadServices) =>
    application({
        state: constructState(services),
        init: app.init(services),
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
        handleMessage: app.handleMessage,
        handleAction: app.handleAction,
        handleEvent: app.handleEvent,
    })