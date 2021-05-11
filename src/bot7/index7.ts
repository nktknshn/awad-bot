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
import { chatstateAction, hasOwnProperty, isObject, reducer } from "Lib/reducer"
import { select } from "Lib/state"
import { composeStores } from "Lib/storeF"
import { AppActionsFlatten, buildApp, ComponentTypes, Defined, GetAllBasics, GetAllComps, GetAllComps1, GetChatState, GetCompGenerator, GetComponent, GetState, GetStateDeps } from "Lib/types-util"
import { TelegrafContext } from "telegraf/typings/context"
import { App as App2 } from '../bot2/app'
import { App as App3 } from '../bot3/app'
import { contextCreatorBot3, store as store3 } from '../bot3/index3'
import { App as App5 } from '../bot5/app'
import { contextCreatorBot5, store as store5 } from '../bot5/index5'
import * as CA from 'Lib/chatactions';
import { reloadInterface } from "Lib/components/actions/misc"
import { setDoFlush } from "bot5/actions"

const select2 = <Props>() => <K extends keyof Props>(
    ...keys: K[]
) => {
    const fromState = <R extends Props>(
        state: R
    ): { [P in K]: Props[P] } =>
        keys.reduce((acc, cur) => ({ ...acc, [cur]: state[cur] }), {} as { [P in K]: Props[P] })

    const fromContext = <Ctx extends { [P in K]: Props[P] }>(context: Ctx) =>
        keys.reduce((acc, cur) => ({ ...acc, [cur]: context[cur] }), {} as { [P in K]: Props[P] })

    return {
        fromState,
        fromContext
    }
}

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

type Refresh = { kind: 'refresh' }
const refresh = (): Refresh => ({ kind: 'refresh' })

type Clear = { kind: 'clear' }
const clear = (): Clear => ({ kind: 'clear' })

const refreshReducer = <R, H>(action: CA.AppChatAction<R, H>) => reducer(
    (a): a is Refresh => isObject(a) && hasOwnProperty(a, 'kind') && a.kind === 'refresh',
    _ => action
)

const clearReducer = <R, H>(action: CA.AppChatAction<R, H>) => reducer(
    (a): a is Clear => isObject(a) && hasOwnProperty(a, 'kind') && a.kind === 'clear',
    _ => action
)

const infoContext = select2<GetChatState<typeof state>>()(
    'activeApp', 'error', 'reloadOnStart', 'bufferedInputEnabled',
    'renderFinished', 'renderStarted', 'bufferActions', 'deferRender', 'doFlush'
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

        if (c.renderFinished && c.renderStarted)
            yield messagePart(`render duration=${c.renderFinished - c.renderStarted}`)

        yield nextMessage()
        yield button('refresh', refresh)
        yield button('doFlush', () => setDoFlush(!c.doFlush))
        yield button('clear', clear)
        yield button('do buffer', () => FL.setBufferedInputEnabled(true))
        yield button('no buffer', () => FL.setBufferedInputEnabled(false))

        yield buttonsRow(['Acts', '+ defer', '- defer', 'flush'],
            (idx, _) => [
                setbufferActions(!c.bufferActions),
                FL.deferRender(c.deferRender + 200),
                FL.deferRender(c.deferRender - 200),
                FL.flush()
            ][idx])

        yield buttonsRow(['app3f', 'app5', 'app2', 'none'],
            (idx, _) => setActiveApp(
                ['app3f', 'app5', 'app2', undefined][idx] as ActiveApp
            ))

    }
)

const App = connected(
    select2<{ activeApp?: ActiveApp }>()('activeApp').fromContext,
    function* ({ activeApp }) {
        // yield contextFromKey('bot2', PinnedCards({}))
        // yield nextMessage()
        yield contextFromKey('info', Info({}))

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
            renderStarted: empty<number>(),
            renderFinished: empty<number>(),
            // flushAction: () => CA.flush
            // flushAction: CA.doNothing
            // XXX
        }),
        userId,
    ])

export const app = pipe(
    buildApp(App, state)
    , a => myDefaultBehaviour(a, {
        renderMessage: a.actions([
            CA.mapState(s => ({ ...s, renderStarted: Date.now() })),
            CA.render,
            CA.mapState(s => ({ ...s, renderFinished: Date.now() })),
            CA.render
        ]),
        flushAction: CA.flush
        // renderAction: a.actions([
        //     CA.mapState(s => ({ ...s, renderStarted: Date.now() })),
        //     CA.render,
        //     CA.mapState(s => ({ ...s, renderFinished: Date.now() })),
        //     CA.render
        // ]),
    })
    , AP.addReducer(_ => bot2Reducers())
    , AP.addReducer(_ => refreshReducer(reloadInterface()))
    , AP.addReducer(_ => clearReducer(_.actions([
        CA.chain(({ chatdata }) => chatdata.useTrackingRenderer
            ? CA.sequence([chatdata.useTrackingRenderer.cleanChatAction, reloadInterface()])
            : CA.mapState(s => ({ ...s, error: 'no tracker installed' })))
    ])))
    , AP.extend(a => ({
        init: ({ services }: { services: AwadServices }) => a.actions([
            a.ext.defaultInit({ cleanOldMessages: true }),
            initBot2('bot2Store')(services)
        ])
    }))
    , AP.context((cs) => ({
        activeApp: cs.activeApp,
        info: infoContext.fromState(cs),
        bot3: contextCreatorBot3(cs),
        bot5: contextCreatorBot5(cs),
        bot2: contextCreatorBot2({ store: cs.bot2Store })
    }))
    // , a => a.extendState<{}>(_ => buildApp(App, state))
    , AP.complete
    , AP.withCreateApplication
)

export const createApp = app.ext.createApplication