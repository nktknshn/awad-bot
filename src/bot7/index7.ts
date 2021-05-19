import { bot2Reducers, contextCreatorBot2, initBot2 } from "bot2/index2"
import { AwadServices } from "bot2/services"
import { createAwadStore } from "bot2/store"
import { flow, identity, pipe } from "fp-ts/lib/function"
import * as CA from 'Lib/chatactions'
import { Tracker } from "Lib/chatrenderer"
import { chatState, empty, stateSelector, subStateSelector } from "Lib/chatstate"
import { ComponentElement, connected } from "Lib/component"
import { reloadInterface } from "Lib/components/actions/misc"
import { timerState, withTimer, WithTimerState } from "Lib/components/actions/rendertimer"
import * as TR from "Lib/components/actions/tracker"
import { contextFromKey, contextSelector } from "Lib/context"
import * as DE from "Lib/defaults"
import { button, messagePart, nextMessage } from "Lib/elements-constructors"
import { action, caseTextEqual, inputHandler, on } from "Lib/input"
import * as AP from "Lib/newapp"
import { composeStores, StoreF2 } from "Lib/storeF"
import { AppActionsFlatten, BasicAppEvent, ComponentReqs, GetChatState, GetState, StateConstructor } from "Lib/types-util"
import { finishBuild, startBuild } from "Lib/appbuilder"
import { App as App2 } from '../bot2/app'
import { App as App3 } from '../bot3/app'
import { contextCreatorBot3, store as store3 } from '../bot3/index3'
import { App as App5 } from '../bot5/app'
import { contextCreatorBot5, store as store5 } from '../bot5/index5'
import { App as App8, bot8state, context as bot8context } from '../bot8/index8'
import {
    App as ObsidianApp, store as obsidianStore,
    context as obsidianContext
} from '../obsidian/obsidian'
import { Info, infoContext } from "./infoContext"
import { toggleInfo, ActiveApp, userId, refreshReducer, clearReducer, refresh } from "./asn"
import { withStore } from "Lib/components/actions/store"
import { select } from "Lib/state"

export type ChatState = GetChatState<typeof state>

const appContext = contextSelector<ChatState>()('activeApp', 'showInfo')

const App = connected(
    appContext.fromContext,
    function* ({ activeApp, showInfo  }) {

        if (showInfo)
            yield contextFromKey('info', Info({}))
        else
            yield button('show', toggleInfo)

        yield inputHandler([
            on(caseTextEqual('/info'), action(toggleInfo))
        ])
        yield messagePart(`doFlush=`);
        yield button('refresh', refresh);

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
    
const context = (cs: GetChatState<typeof state> ) => ({
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
    component: App,
    state,
    context,
    extensions: a => pipe(
        a
        , withTimer
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

// export const getapp = <H extends AppActionsFlatten<RootComponent>,
//     R extends DE.DefaultState & WithTimerState 
//     & Record<'store', StoreF2<unknown, unknown>>, RootComponent extends ComponentElement, P, Deps,
//     Ctx 
//     // Ctx
//     >(
//         app: (props: P) => RootComponent, st: StateConstructor<Deps, R>
//     ) =>
//     DE.defaultBuild({
//         component: app,
//         state: st,
//         context: (cs) => ({
//             a: cs.timerDuration,
//             // activeApp: cs.activeApp,
//             // showInfo: cs.showInfo,
//             // info: infoContext.fromState(cs),
//             // bot3: contextCreatorBot3(cs),
//             // bot5: contextCreatorBot5(cs),
//             // bot2: contextCreatorBot2({ store: cs.bot2Store }),
//             // bot8: bot8context.fromState(cs),
//             // obsidian: obsidianContext(cs)
//         }),
//         extensions: a => pipe(
//             a
//             // withTimer
//             // , a => withStore(a, {
//             //     storeKey: 'store',
//             //     // storeAction: apply => a.sequence([
//             //     //     a.ext.startTimer, apply, a.ext.chatActions.render
//             //     // ])
//             // })
//             // , a => a.ext.redu
//             // , a => a.ext.re
//             // , AP.addReducer(_ => bot2Reducers())
//             // , AP.addReducer(_ => refreshReducer(reloadInterface()))
//             // , AP.addReducer(_ => clearReducer(_.sequence([
//             //     CA.withChatState(({ useTrackingRenderer }) => useTrackingRenderer
//             //         ? CA.sequence([useTrackingRenderer.cleanChatAction, reloadInterface()])
//             //         : CA.mapState(s => ({ ...s, error: 'no tracker installed' })))
//             // ])))
//         )
//     })

// export const { createApplication } = pipe(
//     getapp(App, state)
//     // , a => AP.complete(a)
//     , AP.withCreateApplication
// )

        // extensions: flow(
        //     withTimer
        //     , a => withStore(a, {
        //         storeKey: 'store',
        //         // storeAction: apply => a.sequence([
        //         //     a.ext.startTimer, apply, a.ext.chatActions.render
        //         // ])
        //     })
        //     // , AP.addReducer(_ => bot2Reducers())
        //     // , AP.addReducer(_ => refreshReducer(reloadInterface()))
        //     // , AP.addReducer(_ => clearReducer(_.sequence([
        //     //     CA.withChatState(({ useTrackingRenderer }) => useTrackingRenderer
        //     //         ? CA.sequence([useTrackingRenderer.cleanChatAction, reloadInterface()])
        //     //         : CA.mapState(s => ({ ...s, error: 'no tracker installed' })))
        //     // ])))
        // )

// export const app = <RootComponent extends ComponentElement, P>(
//     app: (props: P) => RootComponent, st: typeof state
// ) => pipe(
//     startBuild(app, st)
//     , withTimer
//     , a => DE.defaultBehaviour(a, {
//         applyInputHandler: a.sequence([a.ext.startTimer, CA.applyInputHandler]),
//         applyActionHandler: a.sequence([a.ext.startTimer, CA.applyActionHandler]),
//         renderMessageWrapper: ({ action }) => action ?? a.action(CA.doNothing),
//         render: a.sequence([CA.render, a.ext.stopTimer]),
//         flushAction: a.sequence([
//             CA.flush,
//             CA.withChatState(({ forgetFlushed, useTrackingRenderer }) =>
//                 CA.onTrue(!!useTrackingRenderer && forgetFlushed,
//                     useTrackingRenderer!.untrackRendererElementsAction))
//         ]),
//     })
//     , a => withStore(a, {
//         storeKey: 'store',
//         storeAction: apply => a.sequence([
//             a.ext.startTimer, apply, a.ext.chatActions.render
//         ])
//     })
//     , AP.extend(a => ({
//         init: ({ services }: { services: AwadServices }) => a.sequence([
//             a.ext.init({ cleanOldMessages: true }),
//             initBot2('bot2Store')(services)
//         ])
//     }))
//     , AP.context((cs) => ({
//         activeApp: cs.activeApp,
//         showInfo: cs.showInfo,
//         info: infoContext.fromState(cs),
//         bot3: contextCreatorBot3(cs),
//         bot5: contextCreatorBot5(cs),
//         bot2: contextCreatorBot2({ store: cs.bot2Store }),
//         bot8: bot8context.fromState(cs),
//         obsidian: obsidianContext(cs)
//     }))
//     , AP.addReducer(_ => bot2Reducers())
//     , AP.addReducer(_ => refreshReducer(reloadInterface()))
//     , AP.addReducer(_ => clearReducer(_.sequence([
//         CA.withChatState(({ useTrackingRenderer }) => useTrackingRenderer
//             ? CA.sequence([useTrackingRenderer.cleanChatAction, reloadInterface()])
//             : CA.mapState(s => ({ ...s, error: 'no tracker installed' })))
//     ])))
//     // , a => a.extendState<{}>(_ => buildApp(App, state))
// )

// export const { createApplication } = AP.withCreateApplication(app2)

// const gettype2 = <RootComp, Ext, H, R>(a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => a

// export const { createApplication } = pipe(
//     app(App, state)
//     , a => AP.complete(a)
//     , AP.withCreateApplication
// )
