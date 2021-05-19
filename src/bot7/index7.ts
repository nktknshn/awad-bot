import { bot2Reducers, contextCreatorBot2 } from "bot2/index2"
import { AwadServices } from "bot2/services"
import { createAwadStore } from "bot2/store"
import { flow, pipe } from "fp-ts/lib/function"
import * as CA from 'Lib/chatactions'
import { Tracker } from "Lib/chatrenderer"
import { chatState, empty } from "Lib/chatstate"
import { connected } from "Lib/component"
import { reloadInterface } from "Lib/components/actions/misc"
import { timerState, withTimer } from "Lib/components/actions/rendertimer"
import { withStore } from "Lib/components/actions/store"
import * as TR from "Lib/components/actions/tracker"
import { contextFromKey, contextSelector } from "Lib/context"
import * as DE from "Lib/defaults"
import { button, messagePart, nextMessage } from "Lib/elements-constructors"
import { action, caseTextEqual, inputHandler, on } from "Lib/input"
import * as AP from "Lib/newapp"
import { composeStores } from "Lib/storeF"
import { GetChatState } from "Lib/types-util"
import { App as App2 } from '../bot2/app'
import { App as App3 } from '../bot3/app'
import { contextCreatorBot3, store as store3 } from '../bot3/index3'
import { App as App5 } from '../bot5/app'
import { contextCreatorBot5, store as store5 } from '../bot5/index5'
import { App as App8, bot8state, context as bot8context } from '../bot8/index8'
import {
    App as ObsidianApp,
    context as obsidianContext, store as obsidianStore
} from '../obsidian/obsidian'
import { ActiveApp, clearReducer, refresh, refreshReducer, toggleInfo, userId } from "./asn"
import { Info, infoContext } from "./infoContext"

export type ChatState = GetChatState<typeof state>

const appContext = contextSelector<ChatState>()('activeApp', 'showInfo')

const App = connected(
    appContext.fromContext,
    function* ({ activeApp, showInfo }) {

        if (showInfo)
            yield contextFromKey('info', Info({}))
        else
            yield button('show', toggleInfo)

        yield inputHandler([
            on(caseTextEqual('/info'), action(toggleInfo))
        ])

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
        else if (activeApp === 'app8') {
            yield contextFromKey('bot8', App8({}))
        }
        else if (activeApp === 'obsidian') {
            yield contextFromKey('obsidian', ObsidianApp({ expandAll: false }))
        }

        yield button('refresh', refresh);
        yield messagePart(`doFlush=`);

    }
)

type Deps = { services: AwadServices, vaultPath: string, t?: Tracker }

const state = ({ services, t, vaultPath }: Deps) =>
    chatState([
        DE.defaultState(),
        TR.withTrackingRenderer(t),
        async () => ({
            activeApp: empty<ActiveApp>(),
            forgetFlushed: false,
            showInfo: true,
            store: composeStores([store3(), store5(), await obsidianStore(vaultPath)]),
            bot2Store: createAwadStore(services),
            // flushAction: () => CA.flush,
            // flushAction: CA.doNothing
            // XXX
        }),
        bot8state,
        timerState,
        userId,
    ])

const context = (cs: GetChatState<typeof state>) => ({
    activeApp: cs.activeApp,
    showInfo: cs.showInfo,
    info: infoContext.fromState(cs),
    bot3: contextCreatorBot3(cs),
    bot5: contextCreatorBot5(cs),
    bot2: contextCreatorBot2({ store: cs.bot2Store }),
    bot8: bot8context.fromState(cs),
    obsidian: obsidianContext(cs)
})

const app = DE.defaultBuild({
    component: App, state, context,
    extensions: flow(
        withTimer
        , a => withStore(a, {
            storeKey: 'store',
            storeAction: apply => a.sequence([
                a.ext.startTimer, apply, a.ext.chatActions.render
            ])
        })
        , AP.addReducer(_ => bot2Reducers())
        , AP.addReducer(_ => refreshReducer(reloadInterface()))
        , AP.addReducer(_ => clearReducer(_.sequence([
            CA.withChatState(({ useTrackingRenderer }) => useTrackingRenderer
                ? CA.sequence([useTrackingRenderer.cleanChatAction, reloadInterface()])
                : CA.mapState(s => ({ ...s, error: 'no tracker installed' })))
        ])))
    )
})

export const { createApplication } = pipe(
    app
    , AP.withCreateApplication
)

console.log('ok');
