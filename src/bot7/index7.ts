import PinnedCards from "bot2/connected/PinnedCards"
import { bot2Reducers, contextCreatorBot2, initBot2 } from "bot2/index2"
import { AwadServices } from "bot2/services"
import { createAwadStore } from "bot2/store"
import { identity, pipe } from "fp-ts/lib/function"
import {
    application, chatState
} from "Lib/application"
import { Tracker } from "Lib/chatrenderer"
import { ComponentElement, connected } from "Lib/component"
import * as FL from "Lib/components/actions/flush"
import * as TR from "Lib/components/actions/tracker"
import { contextFromKey } from "Lib/context"
import { myDefaultBehaviour, setReloadOnStart, withDefaults, setbufferActions, defaultFlushAction } from "Lib/defaults"
import { button, buttonsRow, message, messagePart, nextMessage } from "Lib/elements-constructors"
import { action, caseText, ifTrue, inputHandler, on } from "Lib/input"
import * as AP from "Lib/newapp"
import { chatstateAction, isObject } from "Lib/reducer"
import { select } from "Lib/state"
import { composeStores } from "Lib/storeF"
import { buildApp, ComponentTypes, Defined, GetStateDeps } from "Lib/types-util"
import { TelegrafContext } from "telegraf/typings/context"
import { App as App2 } from '../bot2/app'
import { App as App3 } from '../bot3/app'
import { contextCreatorBot3, store as store3 } from '../bot3/index3'
import { App as App5 } from '../bot5/app'
import { contextCreatorBot5, store as store5 } from '../bot5/index5'
import * as CA from 'Lib/chatactions';

const empty = <T>(): T | undefined => undefined

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

const Info = connected(
    select<{
        activeApp?: ActiveApp, reloadOnStart: boolean,
        bufferedInputEnabled: boolean, deferRender: number
        , bufferActions: boolean
    }>(
        ({ activeApp, reloadOnStart, bufferedInputEnabled, deferRender
            , bufferActions
        }) => ({
            activeApp, reloadOnStart, bufferedInputEnabled, deferRender
            , bufferActions
        })
    ),
    function* ({ activeApp, reloadOnStart, bufferedInputEnabled, deferRender, bufferActions }) {
        yield message(`hi ${activeApp} reloadOnStart=${reloadOnStart}`)
        yield messagePart(`bufferedInputEnabled=${bufferedInputEnabled}`)
        yield messagePart(`deferRender=${deferRender}`)
        yield messagePart(`bufferActions=${bufferActions}`)

        yield nextMessage()
        yield button('do reload', () => setReloadOnStart(true))
        yield button('no reload', () => setReloadOnStart(false))
        yield button('do buffer', () => FL.setBufferedInputEnabled(true))
        yield button('no buffer', () => FL.setBufferedInputEnabled(false))
        yield button('+ defer', () => FL.deferRender(deferRender + 200))
        yield button('- defer', () => FL.deferRender(deferRender - 200))

        yield inputHandler([
            on(caseText,
                ifTrue(({ messageText }) => messageText == 'A'),
                action(_ => [
                    setbufferActions(!bufferActions)
                ])),
        ])

        yield buttonsRow(['app3f', 'app5', 'app2'],
            (_, data) => setActiveApp(data as ActiveApp))

    }
)

const App = connected(
    select<{ activeApp?: ActiveApp }>(({ activeApp }) => ({ activeApp })),
    function* ({ activeApp }) {
        // yield contextFromKey('bot2', PinnedCards({}))
        // yield nextMessage()
        yield Info({})

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

type Deps = { services: AwadServices, t?: Tracker }

const state = ({ services, t }: Deps) =>
    chatState([
        withDefaults(),
        TR.withTrackingRenderer(t),
        async () => ({
            reloadOnStart: true, deferRender: 1500,
            activeApp: empty<ActiveApp>(),
            store: composeStores([store3(), store5()]),
            bot2Store: createAwadStore(services),
            bufferActions: false,
            // flushAction: () => CA.doNothing
            // flushAction: CA.doNothing
            // XXX
        }),
        userId,
    ])

export const app = pipe(
    buildApp(App, state)
    , myDefaultBehaviour()
    , AP.addReducer(_ => bot2Reducers())
    , AP.extend(a => ({
        init: ({ services }: { services: AwadServices }) => a.actions([
            a.ext.defaultInit({ cleanOldMessages: true })
            , initBot2('bot2Store')(services)
        ])
    }))
    , AP.context((cs) => ({
        error: cs.error,
        activeApp: cs.activeApp,
        reloadOnStart: cs.reloadOnStart,
        bufferedInputEnabled: cs.bufferedInputEnabled,
        deferRender: cs.deferRender,
        bufferActions: cs.bufferActions,
        bot3: contextCreatorBot3(cs),
        bot5: contextCreatorBot5(cs),
        bot2: contextCreatorBot2({ store: cs.bot2Store })
    }))
    // , a => a.extendState<{}>(_ => buildApp(App, state))
    , AP.complete
    , AP.createApplication
)

export const createApp = app.ext.createApplication