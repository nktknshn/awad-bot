import { select } from "Lib/state"
import { Lens } from "monocle-ts"
import { append, flush } from "../bot3/util"
import { AppActionsOf, AppEventsOf, Application, ApplicationFor, ChatState, createChatState, defaultHandleAction, defaultRenderScheme, genericRenderComponent, application, initApplication, InitializedApp, InitializedAppFor }
    from "Lib/application"
import * as CA from 'Lib/chatactions'
import { withUserMessages } from "../lib/context"
import {
    createActionEvent, applyActionEventReducer, ApplyActionsEvent,
    makeEventReducer
} from "Lib/event"
import { ChatStateAction,  ChatStateAction2, composeReducers, extendDefaultReducer, flushReducer, reducer, storeReducer } from "Lib/reducer"
import { storeAction, storef, StoreF } from "Lib/storeF"
import { AppActions, AppActionsFlatten, Flatten, GetAllBasics, GetAllButtons, GetAllComps, GetAllInputHandlersTypes, GetComponent, GetProps, GetRootState, _GetAllComps } from "Lib/types-util"
import { ComponentConnected, ComponentElement, ComponentGenerator, connected, mapped } from "Lib/component"
import { button, message } from "Lib/elements-constructors"
import { contextCreatorBot5, createApp as createAppBot5 } from '../bot5/index5'
import { App as App5 } from '../bot5/app'
import { App as App3 } from '../bot3/app'
import { app as appBot3f } from '../bot3/index3'
import { Apply1 } from "fp-ts/lib/Apply"
import * as O from 'fp-ts/lib/Option'
import { OpaqueChatHandler } from "Lib/chathandler"
import { TelegrafContext } from "telegraf/typings/context"
import { BasicElement, ButtonElement, ButtonsRowElement, EffectElement, InputHandlerElement } from "Lib/elements"
import { createDraftWithImages } from "Lib/draft"


export const setActiveApp = (app?: 'app5' | 'app3f') => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { activeApp?: 'app5' | 'app3f' }>(s: R) =>
        ({ ...s, activeApp: app })
})

const Routed =
    <P extends M, S, M, State, PP, H, K extends keyof any, E>
        (
            key: K,
            comp: ComponentConnected<P & PP, S, M, State, BasicElement<H> | ComponentElement<E>>)
        : ComponentConnected<P & PP, S, M, State, RoutedE<BasicElement<H> | ComponentElement<E>, K>> => {
        return mapped(comp, (el) => {
            if ('kind' in el && el.kind === 'ButtonElement') {
                return el.mapCallback((h): RoutedActionT<H, K> => ({
                    kind: 'routed-action',
                    receiver: key,
                    action: h
                }))
            }
            else if ('kind' in el && el.kind === 'ButtonsRowElement') {
                return el.mapCallback((h): RoutedActionT<H, K> => ({
                    kind: 'routed-action',
                    receiver: key,
                    action: h
                }))
            }
            else if ('kind' in el && el.kind === 'EffectElement') {
                return el.mapCallback((h): RoutedActionT<H, K> => ({
                    kind: 'routed-action',
                    receiver: key,
                    action: h
                }))
            }
            else if (el.kind === 'component-with-state-connected') {
                return Routed(key, el as any) as any
            }
            // else if ('kind' in el && el.kind === 'InputHandlerElement') {
            //     return el.mapCallback((h): RoutedActionT<H, K> => ({
            //         kind: 'routed-action',
            //         receiver: key,
            //         action: h!
            //     }))
            // }
            return el
        })
    }

type RoutedE<T, K extends keyof any> =
    T extends ButtonElement<infer R> ? ButtonElement<RoutedActionT<R, K>>
    : T extends InputHandlerElement<infer R> ? InputHandlerElement<RoutedActionT<R, K>>
    : T extends EffectElement<infer R> ? EffectElement<RoutedActionT<R, K>>
    : T extends ButtonsRowElement<infer R> ? ButtonsRowElement<RoutedActionT<R, K>>
    : T extends ComponentConnected<infer P, infer S, infer M, infer RS, infer E>
    ? ComponentConnected<P, S, M, RS, RoutedE<E, K>>
    : T


type GetRoutedActionT<T, K extends keyof any> = RoutedActionT<Flatten<T extends RoutedActionT<infer A1, K> ? Flatten<A1> : never>, K>
type GetNotRoutedActionT<T> = T extends RoutedActionT<infer A1, infer K> ? never : Flatten<T>


function Appl<K extends keyof any, R, H, E>(
    key: K,
    app: Application<R, H, E>
) {

}

type App5Type = typeof App5

type App5Actions = AppActionsFlatten<App5Type>
type App5Basic = GetAllBasics<App5Type>

type IsFunction<T> = T extends (props: infer P) =>
    ComponentConnected<infer P, infer S, infer M, infer RootState, infer E> ? true : false

interface ComponentTypes<T> {
    actions: AppActionsFlatten<T>
    elements: GetAllBasics<T>
    comps: GetAllComps<T>
    context: ComponentReqs<T>
    rootState: GetRootState<GetComponent<T>>
    isFunction: IsFunction<T>
    props: GetProps<T>
}

interface ComponentReqs<T, CT extends ComponentTypes<T> = ComponentTypes<T>> {
    actions: CT['actions'],
    context: CT['context'],
}

const bot5 = createAppBot5()

type D<T> = T

type X = ComponentTypes<App5Type>
type OOOO = X['context']
type O2 = GetRootState<X['comps']>

const App = connected(
    select((c: { activeApp?: 'app5' | 'app3f' }) => ({ activeApp: c.activeApp })),
    function* ({ activeApp }) {
        yield message(`hi ${activeApp}`)

        yield button('app3f', () => [
            setActiveApp('app3f')
        ])

        yield button('app5', () => [
            setActiveApp('app5')
        ])

        if (activeApp === 'app5') {
            // yield Appl('app5', bot5, App5({}))
            yield App5({})
            // yield Appl('app5', App5({}))

        }
        // else if (activeApp === 'app3f') {
        //     yield Routed('app3f', App3({ password: 'a' }))
        // }
    }
)

interface RoutedEventT<E, T> {
    receiver: keyof T,
    event: E,
    kind: 'routed-event'
}

const routedEventT = <E, T>(receiver: keyof T, e: E): RoutedEventT<E, T> => {
    return {
        receiver,
        event: e,
        kind: 'routed-event'
    }
}

function routedQueue<E, T, Q extends OpaqueChatHandler<RoutedEventT<E, T>>>(
    receiver: keyof T,
    q: Q
): OpaqueChatHandler<E> {
    return {
        handleMessage(ctx: TelegrafContext): Promise<unknown> {
            return q.handleMessage(ctx)
        },
        handleAction(ctx: TelegrafContext): Promise<unknown> {
            return q.handleAction(ctx)
        },
        handleEvent(ctx?: TelegrafContext): (event: E) => Promise<unknown> {
            return event => q.handleEvent(ctx)(routedEventT(receiver, event))
        }
    }
}

type GetEvents<T> = T extends Record<keyof T, infer V>
    ? V extends InitializedApp<infer R, infer H, infer E> ? Flatten<E> : never : never

type GetActions<T> = T extends Record<keyof T, infer V>
    ? V extends InitializedApp<infer R, infer H, infer E> ? Flatten<H> : never : never


interface RoutedActionT<H, K extends keyof any> {
    action: H,
    receiver: K,
    kind: 'routed-action'
}

export const routedEventReducer = <
    R extends Record<'apps',
        { [K in keyof R['apps']]: InitializedApp<any, any, any> }>,
    H, E>() =>
    reducer(
        <A>(a: RoutedEventT<GetEvents<R['apps']>, R['apps']> | A)
            : a is RoutedEventT<GetEvents<R['apps']>, R['apps']> =>
            'kind' in a && a.kind === 'routed-event',
        event => async (ctx: CA.ChatActionContext<R, H, E>) => {
            return {
                ...ctx.chatdata,
                apps: {
                    ...ctx.chatdata.apps,
                    [event.receiver]: {
                        chatdata: await (ctx.chatdata.apps[event.receiver] as any).app.handleEvent(event)
                    }
                }
            }
        }
    )


export const routedActionReducer = <
    R extends Record<'apps',
        { [KK in keyof RR]: InitializedApp<any, any, any> }>,
    H, E,
    RR extends R['apps'],
    K extends keyof RR>(key: K) =>
    reducer<
        RoutedActionT<AppActionsOf<ApplicationFor<RR[K]>>, K>,
        (ctx: CA.ChatActionContext<R, H, E>) => Promise<ChatState<R, H>>
    >(
        <A>(a: RoutedActionT<AppActionsOf<ApplicationFor<RR[K]>>, K> | A)
            : a is RoutedActionT<AppActionsOf<ApplicationFor<RR[K]>>, K> =>
            'kind' in a && a.kind === 'routed-action' && key == a.receiver,
        a => async (ctx: CA.ChatActionContext<R, H, E>) => {

            // console.log(`data: ${key}`);

            const data = await CA.sequence((ctx.chatdata.apps)[key].app.actionReducer(a.action))(
                {
                    app: ctx.chatdata.apps[key].app,
                    chatdata: ctx.chatdata.apps[key].chatdata,
                    renderer: ctx.chatdata.apps[key].renderer,
                    tctx: ctx.tctx,
                    queue: routedQueue<AppEventsOf<ApplicationFor<RR[K]>>, R['apps'],
                        OpaqueChatHandler<any>>(key, ctx.queue)
                }
            )
            // console.log(`data: ${JSON.stringify(data)}`);

            return {
                ...ctx.chatdata,
                apps: {
                    ...ctx.chatdata.apps,
                    [key]: {
                        ...ctx.chatdata.apps[key],
                        chatdata: data,
                    }
                }
            }
        }
    )

const apps = {
    app5: createAppBot5(),
    app3f: appBot3f,
}

type AppState = {
    apps: {
        app5: InitializedAppFor<ReturnType<typeof createAppBot5>>,
        app3f: InitializedAppFor<typeof appBot3f>,
    },
    activeApp?: 'app5' | 'app3f'
}

type AppType = typeof App
type AppAction_ = AppActionsFlatten<typeof App>
type AppAction = GetRoutedActionT<AppAction_, 'app5'> | GetNotRoutedActionT<AppAction_>

type AA<T> = T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E> ? E : never
type A1 = AppType extends (P: infer P) => infer A ? AA<A> : never
type A2 = AA<A1>
type A3 = AA<A2>


type AppChatState = ChatState<AppState, AppAction>

type AppEvents = ApplyActionsEvent<AppState, AppAction, AppEvents>
    | RoutedEventT<GetEvents<AppState['apps']>, AppState['apps']>

export const createApp = () =>
    application<AppState, AppAction, AppEvents>({
        actionReducer: extendDefaultReducer(
            flushReducer(CA.doNothing),
            // routedActionReducer('app5')
        ),
        renderFunc: genericRenderComponent(
            defaultRenderScheme(),
            {
                component: App,
                contextCreator: (cs) => ({
                    activeApp: cs.activeApp,
                    ...contextCreatorBot5(cs.apps.app5.chatdata)
                }),
                props: {}
            }),
        state: async (tctx) =>
            createChatState({
                apps: {
                    app5: await initApplication(apps.app5)(tctx),
                    app3f: await initApplication(apps.app3f)(tctx)
                },
                activeApp: undefined
            }),
        init: async (ctx) => {
            return {
                ...ctx.chatdata,
                apps: {
                    app5: {
                        ...ctx.chatdata.apps.app5,
                        chatdata: (await ctx.chatdata.apps.app5.app.init({
                            app: ctx.chatdata.apps.app5.app,
                            chatdata: ctx.chatdata.apps.app5.chatdata,
                            renderer: ctx.chatdata.apps.app5.renderer,
                            tctx: ctx.tctx,
                            queue: routedQueue('app5', ctx.queue)
                        }))
                    },
                    app3f: {
                        ...ctx.chatdata.apps.app3f,
                        chatdata: (await ctx.chatdata.apps.app3f.app.init({
                            app: ctx.chatdata.apps.app3f.app,
                            chatdata: ctx.chatdata.apps.app3f.chatdata,
                            renderer: ctx.chatdata.apps.app3f.renderer,
                            tctx: ctx.tctx,
                            queue: routedQueue('app3f', ctx.queue)
                        }))
                    },
                }
            }
        },
        handleAction: CA.sequence(
            [CA.applyActionHandler, CA.replyCallback, CA.render]
        ),
        handleMessage: CA.sequence([
            CA.addRenderedUserMessage(),
            CA.applyInputHandler,
            CA.render
        ]),
        handleEvent: makeEventReducer(
            composeReducers(
                routedEventReducer(),
                applyActionEventReducer(),
            )
        ),
    })