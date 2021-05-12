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
import { contextFromKey, contextSelector } from "Lib/context"
import { myDefaultBehaviour, setReloadOnStart, withDefaults, setbufferActions, defaultFlushAction, withStore } from "Lib/defaults"
import { button, buttonsRow, message, messagePart, nextMessage } from "Lib/elements-constructors"
import { action, caseText, ifTrue, inputHandler, on } from "Lib/input"
import * as AP from "Lib/newapp"
import { chatstateAction, hasKind, hasOwnProperty, isObject, reducer } from "Lib/reducer"
import { select } from "Lib/state"
import { composeStores } from "Lib/storeF"
import { AppActionsFlatten, BasicAppEvent, buildApp, ComponentTypes, Defined, GetAllBasics, GetAllComps, GetAllComps1, GetChatState, GetCompGenerator, GetComponent, GetState, GetStateDeps } from "Lib/types-util"
import { TelegrafContext } from "telegraf/typings/context"
import { App as App2 } from '../bot2/app'
import { App as App3 } from '../bot3/app'
import { contextCreatorBot3, store as store3 } from '../bot3/index3'
import { App as App5 } from '../bot5/app'
import { App as App8 } from '../bot8/index8'

import { contextCreatorBot5, store as store5 } from '../bot5/index5'
import * as CA from 'Lib/chatactions';
import { reloadInterface } from "Lib/components/actions/misc"
import { setDoFlush } from "bot5/actions"

const empty = <T>(): T | undefined => undefined

const userId = async (tctx: TelegrafContext) => ({
    userId: tctx.from?.id!,
})

const username = async (tctx: TelegrafContext) => ({
    username: tctx.from?.username,
})
const apps = ['app3f', 'app5', 'app2', 'app8']

type ActiveApp = 'app3f'| 'app5' | 'app2' | 'app8'


export const setActiveApp = (activeApp?: ActiveApp) =>
    chatstateAction<{ activeApp?: ActiveApp }>(s =>
        ({ ...s, activeApp })
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

const asn = (a: boolean) => a ? 1 : 0

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
        yield button(`doFlush (${asn(c.doFlush)})`, () => setDoFlush(!c.doFlush))
        yield button('clear', clear)
        yield button(`buffer (${asn(c.bufferedInputEnabled)})`, () => FL.setBufferedInputEnabled(!c.bufferedInputEnabled))

        yield buttonsRow([`Acts (${asn(c.bufferActions)})`, '+ defer', '- defer', 'flush'],
            (idx, _) => [
                setbufferActions(!c.bufferActions),
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

const appContext = contextSelector<{ activeApp?: ActiveApp }>()('activeApp')

const App = connected(
    appContext.fromContext,
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
        else if (activeApp === 'app8') {
            yield contextFromKey('bot8', App8({ }))
            // XXX
            // yield App8({ })
        }
    }
)

type Deps = { services: AwadServices, t?: Tracker }

const state = ({ services, t }: Deps) =>
    chatState([
        withDefaults(),
        TR.withTrackingRenderer(t),
        async () => ({
            activeApp: empty<ActiveApp>(),
            store: composeStores([store3(), store5()]),
            bot2Store: createAwadStore(services),
            renderStarted: empty<number>(),
            renderFinished: empty<number>(),
            renderDuration: 0,
            forgetFlushed: false,
            a: 0
            // flushAction: () => CA.flush
            // flushAction: CA.doNothing
            // XXX
        }),
        userId,
    ])

// const A = buildApp(App, state)
//  =
// (apply: CA.AppChatAction<R, H>
//     ) => a.actions([apply, CA.render]) 


export const app = <RootComponent extends ComponentElement, P>(
    app: (props: P) => RootComponent, s: typeof state
) => {
    return pipe(
        buildApp(app, s)
        , AP.extend(a => ({
            withTimer: a.actions([
                CA.mapState(s => ({ ...s, renderStarted: Date.now() })),
                CA.render,
                CA.mapState(s => ({
                    ...s,
                    renderFinished: Date.now(),
                    renderDuration: Date.now() - s.renderStarted!
                })),
            ])
        }))
        , a => myDefaultBehaviour(a, {
            render: a.ext.withTimer,
            flushAction: a.actions([
                CA.flush,
                CA.chatState(({ forgetFlushed, useTrackingRenderer }) =>
                    CA.onTrue(!!useTrackingRenderer && forgetFlushed,
                        useTrackingRenderer!.untrackRendererElementsAction))
            ]),
        })
        , a => withStore(a, {
            storeKey: 'store',
            storeAction: apply => a.actions([
                apply, a.ext.chatActions.render
            ])
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
                a.ext.attachStore_store,
                initBot2('bot2Store')(services)
            ])
        }))
        , AP.context((cs) => ({
            activeApp: cs.activeApp,
            info: infoContext.fromState(cs),
            bot3: contextCreatorBot3(cs),
            bot5: contextCreatorBot5(cs),
            bot2: contextCreatorBot2({ store: cs.bot2Store }),
            bot8: ({
                error: cs.error,
                a: cs.a
            })
        }))
        // , a => a.extendState<{}>(_ => buildApp(App, state))
        // , AP.complete
        // , AP.withCreateApplication
    )
}

export const apppp = app(App, state)