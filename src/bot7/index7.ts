import { bot2Reducers, contextCreatorBot2, initBot2 } from "bot2/index2"
import { AwadServices } from "bot2/services"
import { createAwadStore } from "bot2/store"
import { setDoFlush } from "bot5/actions"
import { pipe } from "fp-ts/lib/function"
import * as CA from 'Lib/chatactions'
import { Tracker } from "Lib/chatrenderer"
import { chatState, empty, subStateSelector } from "Lib/chatstate"
import { ComponentElement, connected } from "Lib/component"
import * as FL from "Lib/components/actions/flush"
import { reloadInterface } from "Lib/components/actions/misc"
import { renderTimerState, renderWithTimer } from "Lib/components/actions/rendertimer"
import * as TR from "Lib/components/actions/tracker"
import { contextFromKey, contextSelector } from "Lib/context"
import * as DE from "Lib/defaults"
import { button, buttonsRow, messagePart, nextMessage } from "Lib/elements-constructors"
import { action, caseTextEqual, inputHandler, on } from "Lib/input"
import * as AP from "Lib/newapp"
import { chatStateAction, hasKind, reducer } from "Lib/reducer"
import { composeStores } from "Lib/storeF"
import { BasicAppEvent, buildApp, GetChatState, Utils } from "Lib/types-util"
import { TelegrafContext } from "telegraf/typings/context"
import { App as App2 } from '../bot2/app'
import { App as App3 } from '../bot3/app'
import { contextCreatorBot3, store as store3 } from '../bot3/index3'
import { App as App5 } from '../bot5/app'
import { contextCreatorBot5, store as store5 } from '../bot5/index5'
import { App as App8, bot8state, context as bot8context } from '../bot8/index8'

const asn = (a: boolean) => a ? 1 : 0

const userId = async (tctx: TelegrafContext) => ({
    userId: tctx.from?.id!,
})

const username = async (tctx: TelegrafContext) => ({
    username: tctx.from?.username,
})

const apps = ['app3f', 'app5', 'app2', 'app8']

type ActiveApp = 'app3f' | 'app5' | 'app2' | 'app8'

export const setActiveApp = (activeApp?: ActiveApp) =>
    chatStateAction<{ activeApp?: ActiveApp }>(s =>
        ({ ...s, activeApp })
    )

export const toggleInfo = () =>
    chatStateAction<{ showInfo: boolean }>(s =>
        ({ ...s, showInfo: !s.showInfo })
    )

type Refresh = { kind: 'refresh' }
const refresh = (): Refresh => ({ kind: 'refresh' })

type Clear = { kind: 'clear' }
const clear = (): Clear => ({ kind: 'clear' })

const refreshReducer = <R, H>(action: CA.AppChatAction<R, H>) => reducer(
    hasKind<Refresh>('refresh'),
    _ => action
)

const clearReducer = <R, H>(action: CA.AppChatAction<R, H>) => reducer(
    hasKind<Clear>('clear'),
    _ => action
)

type ChatState = GetChatState<typeof state>

const infoContext = contextSelector<ChatState>()(
    'activeApp', 'error', 'reloadOnStart', 'bufferedInputEnabled',
    'renderFinished', 'renderStarted', 'bufferActions', 'deferRender', 'doFlush',
    'renderDuration'
)

const Info = connected(
    infoContext.fromContext,
    function* (c) {
        yield messagePart(`hi ${c.activeApp} reloadOnStart=${c.reloadOnStart}`)
        yield messagePart(`error=${c.error}`)
        yield messagePart(`bufferedInputEnabled=${c.bufferedInputEnabled}`)
        yield messagePart(`deferRender=${c.deferRender}`)
        yield messagePart(`bufferActions=${c.bufferActions}`)
        yield messagePart(`doFlush=${c.doFlush}`)

        yield messagePart(`render duration=${c.renderDuration}`)

        yield nextMessage()
        yield button('refresh', refresh)
        yield button('clear', clear)
        yield button('hide', toggleInfo)

        yield button(`doFlush (${asn(c.doFlush)})`, () => setDoFlush(!c.doFlush))
        yield button(`buffer (${asn(c.bufferedInputEnabled)})`, () => FL.setBufferedInputEnabled(!c.bufferedInputEnabled))

        yield buttonsRow([`Acts (${asn(c.bufferActions)})`, '+ defer', '- defer', 'flush'],
            (idx, _) => [
                DE.setbufferActions(!c.bufferActions),
                FL.deferRender(c.deferRender + 200),
                FL.deferRender(c.deferRender - 200),
                FL.flush()
            ][idx])


        yield buttonsRow([...apps, 'none'],
            (idx, _) => setActiveApp(
                [...apps, undefined][idx] as ActiveApp
            ))
    }
)

const appContext = contextSelector<{
    activeApp?: ActiveApp,
    showInfo: boolean
}>()('activeApp', 'showInfo')

const App = connected(
    appContext.fromContext,
    function* ({ activeApp, showInfo }) {

        if (showInfo)
            yield contextFromKey('info', Info({}))

        yield inputHandler([
            on(caseTextEqual('/info'), action(toggleInfo))
        ])

        yield nextMessage()

        if (activeApp === 'app5') {
            yield contextFromKey('bot5', App5({}))
        }
        else if (activeApp === 'app3f') {
            yield contextFromKey('bot3', App3({ password: 'a' }))
            App3({ password: 'a' })
        }
        else if (activeApp === 'app2') {
            yield contextFromKey('bot2', App2({ showPinned: false }))
        }
        else if (activeApp === 'app8') {
            yield contextFromKey('bot8', App8({}))
        }
    }
)

type Deps = { services: AwadServices, t?: Tracker }

const state = ({ services, t }: Deps) =>
    chatState([
        DE.withDefaults(),
        TR.withTrackingRenderer(t),
        async () => ({
            activeApp: empty<ActiveApp>(),
            store: composeStores([store3(), store5()]),
            bot2Store: createAwadStore(services),
            forgetFlushed: false,
            showInfo: true
            // flushAction: () => CA.flush
            // flushAction: CA.doNothing
            // XXX
        }),
        bot8state,
        renderTimerState,
        userId,
    ])


export const app = <RootComponent extends ComponentElement, P>(
    app: (props: P) => RootComponent, s: typeof state
) => pipe(
    buildApp(app, s)
    , renderWithTimer
    , a => DE.myDefaultBehaviour(a, {
        render: a.ext.renderWithTimer,
        flushAction: a.actions([
            CA.flush,
            CA.withChatState(({ forgetFlushed, useTrackingRenderer }) =>
                CA.onTrue(!!useTrackingRenderer && forgetFlushed,
                    useTrackingRenderer!.untrackRendererElementsAction))
        ]),
    })
    , a => DE.withStore(a, {
        storeKey: 'store',
        storeAction: apply => a.actions([
            apply, a.ext.chatActions.render
        ])
    })
    , AP.extend(a => ({
        init: ({ services }: { services: AwadServices }) => a.actions([
            a.ext.defaultInit({ cleanOldMessages: true }),
            a.ext.attachStore_store,
            initBot2('bot2Store')(services)
        ])
    }))
    , AP.context((cs) => ({
        bot8: ({
            error: cs.error,
            a: cs.a,
            gameMessage: cs.gameMessage
        }),
        activeApp: cs.activeApp,
        showInfo: cs.showInfo,
        info: infoContext.fromState(cs),
        bot3: contextCreatorBot3(cs),
        bot5: contextCreatorBot5(cs),
        bot2: contextCreatorBot2({ store: cs.bot2Store }),
    }))
    , AP.addReducer(_ => bot2Reducers())
    , AP.addReducer(_ => refreshReducer(reloadInterface()))
    , AP.addReducer(_ => clearReducer(_.actions([
        CA.withChatState(({ useTrackingRenderer }) => useTrackingRenderer
            ? CA.sequence([useTrackingRenderer.cleanChatAction, reloadInterface()])
            : CA.mapState(s => ({ ...s, error: 'no tracker installed' })))
    ])))
    // , a => a.extendState<{}>(_ => buildApp(App, state))
)

// const gettype2 = <RootComp, Ext, H, R>(a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => a

const { createApplication } = pipe(
    app(App, state)
    , AP.complete
    , AP.withCreateApplication
)

console.log('ok');

export const ca = createApplication