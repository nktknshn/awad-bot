import { flow, pipe } from "fp-ts/lib/function";
import { TelegrafContext } from "telegraf/typings/context";
import { Application, application, defaultRenderScheme, genericRenderComponent } from "./application";
import * as CA from './chatactions';
import { ChatState } from "./chatstate";
import { FlushState } from "./components/actions/flush";
import { connectFStore } from "./components/actions/store";
import { UseTrackingRenderer } from "./components/actions/tracker";
import { applyActionEventReducer, makeEventReducer } from "./event";
import { ChatActionReducer, ChatStateAction, composeReducers, defaultReducer, ReducerFunction, reducerToFunction } from "./reducer";
import { StoreF2 } from "./storeF";
import { LocalStateAction } from "./tree2";
import { BasicAppEvent, If, IfDef } from "./types-util";
import { RenderFunc, AppBuilder } from "./appbuilder";


export function attachStore<K extends keyof R,
    R extends Record<K, StoreF2<unknown, unknown>>>(key: K) {
    return function attachStore<H, Ext, RootComp>
        (a: AppBuilder<R, H, Ext, RootComp>)
        : AppBuilder<R, H,
            Ext & Record<`attachStore_${string & K}`,
                CA.AppChatAction<R, H>>, RootComp> {

        return a.extend(a => ({
            [`attachStore_${key}`]: connectFStore(a, key)
        }) as Record<`attachStore_${string & K}`,
            CA.AppChatAction<R, H, BasicAppEvent<R, H>>>)
    }

}

export type WithHandleEvent<R, H> = {
    handleEvent: (ctx: CA.ChatActionContext<R, H, BasicAppEvent<R, H>>, event: BasicAppEvent<R, H>) => Promise<ChatState<R, H>>;
}

export function handleEventExtension<Ext, R extends FlushState, H, T, RootComp>
    (a: AppBuilder<R, H, Ext, RootComp>)
    : WithHandleEvent<R, H> {
    return {
        handleEvent: a.eventFunc(
            makeEventReducer(
                composeReducers(
                    applyActionEventReducer(),
                )
            ))
    }
}

export function handleEventExtension2<Ext, R extends FlushState, H, T, RootComp>
    (a: AppBuilder<R, H, Ext, RootComp>)
    : WithHandleEvent<R, H> {
    return {
        handleEvent: a.eventFunc(
            makeEventReducer(
                composeReducers(
                    applyActionEventReducer(),
                )
            ))
    }
}

export type WithInit<R, H, Deps> = {
    init?: (deps: Deps) => CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
}

export function withInit<
    R extends FlushState & UseTrackingRenderer, H, Ext, RootComp>
    (f: (a: AppBuilder<R, H, Ext, RootComp>, ext: Ext) =>
        CA.AppChatAction<R, H, BasicAppEvent<R, H>>)
    : (a: AppBuilder<R, H, Ext, RootComp>) =>
        AppBuilder<R, H, Ext & WithInit<R, H, {}>, RootComp> {
    return (a: AppBuilder<R, H, Ext, RootComp>) => a.extend(a => ({ init: () => f(a, a.ext) }))
}


export function props<P>(props: P) {
    return function <R, H, Ext, RootComp>
        (a: AppBuilder<R, H, Ext, RootComp>)
        : AppBuilder<R, H, Ext & WithProps<P>, RootComp> {
        return a.extend(_ => ({ props }))
    }
}

export function context<Ctx, R, H>(
    contextCreator: (cs: ChatState<R, H>) => Ctx) {
    return function withContextCreator<Ext, RootComp>
        (a: AppBuilder<R, H, Ext, RootComp>)
        : AppBuilder<R, H, Ext & WithContextCreator<R, H, Ctx>, RootComp> {
        return a.extend(_ => ({ contextCreator }))
    }
}

export function renderExtension<
    R, H, RootComp, P,
    Ctx extends RootComp
>
    (a: AppBuilder<R, H, WithComponent<P, RootComp>, RootComp>)
    : WithRender<R, H, P, Ctx> {
    return ({
        render(
            contextCreator: (cs: ChatState<R, H>) => Ctx,
            props: P
        ) {
            return a.renderFunc(
                genericRenderComponent(
                    defaultRenderScheme(), {
                    component: a.ext.realfunc,
                    props,
                    contextCreator
                }))
        }
    })
}

export type WithComponent<P, RootComponent> = {
    // component: (props: P) => RootComponent
    component: 'component'
    realfunc: any
}

export type WithState<T> = {
    state: T
}

export type WithRender<R, H, P, Ctx> = {
    render: (contextCreator: (cs: ChatState<R, H>) => Ctx, props: P) => RenderFunc<R, H>
}

export type WithProps<P> = {
    props: P
}

export type WithContextCreator<R, H, Ctx> = {
    contextCreator: (cs: ChatState<R, H>) => Ctx
}

export type WithRenderFunc<R, H> = {
    renderFunc: RenderFunc<R, H>;
}

export function renderFuncExtension<
    R, H, RootComp, P, Ctx, Ext
>
    (a: AppBuilder<R, H,
        Ext & WithProps<P>
        & WithContextCreator<R, H, Ctx>
        & WithRender<R, H, P, Ctx>, RootComp>)
    : AppBuilder<R, H,
        WithRenderFunc<R, H> & Ext
        , RootComp> {
    return a.extend(a => ({
        renderFunc: a.ext.render(a.ext.contextCreator, a.ext.props)
    }))
}
// {
//     actionReducer: ReducerFunction<R, H, H, BasicAppEvent<R, H>>;
// }
type WithReducerFunction<R, H1, H2, E> = {
    actionReducer: ReducerFunction<R, H1, H2, E>
}

export type WithReducer<T1, R, H,> = {
    reducer: ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>
}

export type DefaultActions<R, H> = LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | undefined

export function withDefaultReducer<R, H, Ext, RootComp>(
    a: AppBuilder<R, H, Ext, RootComp>,
): WithReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | undefined, R, H> {
    return { reducer: a.reducerFunc(defaultReducer()) }
}
// ChatActionReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | undefined, R, H, E>

export function withDefaultReducer2(
    defaultReducer: <R, H, E>() => ChatActionReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | undefined, R, H, E>
) {
    return function <R, H, Ext, RootComp>(
        a: AppBuilder<R, H, Ext, RootComp>,
    ): WithReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | undefined, R, H> {
        return { reducer: a.reducerFunc(defaultReducer()) }
    }
}

export function addReducer<T1, T2, R, H, Ext, RootComp>(
    f: (a: AppBuilder<R, H, WithReducer<T2, R, H> & Ext, RootComp>) =>
        ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>
) {
    return (a: AppBuilder<R, H, WithReducer<T2, R, H> & Ext, RootComp>) =>
        a.extend(a => ({
            reducer: composeReducers(a.ext.reducer, f(a))
        }))
}

export function withActionReducer<R, H extends H1, Ext, RootComp, H1>(
    a: AppBuilder<R, H, Ext & WithReducer<H1, R, H>, RootComp>,
): AppBuilder<R, H,
    Ext
    & WithReducer<H1, R, H>
    & WithReducerFunction<R, H, H, BasicAppEvent<R, H>>,
    RootComp> {
    return a.extend(a => ({
        actionReducer: a.reducer(reducerToFunction(a.ext.reducer))
    }))
}

export function extend<RootComp, R, H, Ext, RR>(f: (a: AppBuilder<R, H, Ext, RootComp>) => RR) {
    return function (a: AppBuilder<R, H, Ext, RootComp>)
        : AppBuilder<R, H, Ext & RR, RootComp> {
        return a.extend(f)
    }
}

export function extendKey<RootComp, R, H, Ext, RR, K extends keyof any>(
    key: K,
    f: (a: AppBuilder<R, H, Ext, RootComp>) => RR
) {
    return function (a: AppBuilder<R, H, Ext, RootComp>)
        : AppBuilder<R, H, Ext & Record<K, RR>, RootComp> {
        return a.extend(a => ({ [key]: f(a) }) as Record<K, RR>)
    }
}


export function defaultBuild<
    R extends FlushState & UseTrackingRenderer,
    H, Ext, RootComp, Ctx extends RootComp, T, P>
    (u: AppBuilder<R, H,
        WithComponent<P, RootComp>
        & WithState<T> 
        & Ext,
        RootComp
    >): AppBuilder<R, H,
        WithComponent<P, RootComp>
        & WithState<T>
        & WithReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | undefined, R, H>
        & WithHandleEvent<R, H>
        & WithRender<R, H, P, Ctx>
        & Ext,
        RootComp
    > {
    return u.extend(handleEventExtension)
        .extend(renderExtension)
        .extend(withDefaultReducer)
}

// export const finishBuild = flow(
//     complete,
//     withCreateApplication
// )

export const finishBuild = () => complete


export function complete<
H extends H1, P, Ctx extends RootComp, RootComp, R,Ext, H1,
    StateDeps, TypeAssert extends IfDef<H, {}, never> = IfDef<H, {}, never>
    >
    (a: AppBuilder<R, H,
        & Ext
        & WithRender<R, H, P, Ctx>
        & WithContextCreator<R, H, Ctx>
        & WithReducer<H1, R, H>
        & WithComponent<P, RootComp>
        & WithProps<P>
        & WithState<(d: StateDeps) => (tctx: TelegrafContext) => Promise<ChatState<R, H>>>
        , RootComp>)
    : AppBuilder<R, H,
        Ext & WithReducerFunction<R, H, H, BasicAppEvent<R, H>>
        & WithRenderFunc<R, H>
        , RootComp> {

    return pipe(
        a,
        renderFuncExtension,
        withActionReducer,
    )
}

export type OnUndefined<T> = If<T, undefined, {}, T>

export function withCreateApplication<
    R, H, RootComp, Ext, InitDeps, StateDeps
>
    (a: AppBuilder<R, H,
        & WithReducerFunction<R, H, H, BasicAppEvent<R, H>>
        & WithRenderFunc<R, H>
        & WithState<(d: StateDeps) => (tctx: TelegrafContext) => Promise<ChatState<R, H>>>
        & WithInit<R, H, InitDeps>
        & WithHandleEvent<R, H>
        & Record<'handleMessage', CA.AppChatAction<R, H>>
        & Record<'handleAction', CA.AppChatAction<R, H>>
        & Ext
        , RootComp>) {

    const app = a.extend(_ => ({
        createApplication: (deps: InitDeps & StateDeps): Application<R, H> => {
            const state = _.ext.state(deps)
            const actionReducer = _.ext.actionReducer
            const handleMessage = _.ext.handleMessage
            const handleAction = _.ext.handleAction
            const handleEvent = _.ext.handleEvent
            const renderFunc = _.ext.renderFunc

            return application({
                state,
                init: _.ext.init ? _.ext.init(deps) : undefined,
                actionReducer,
                handleMessage,
                handleAction,
                handleEvent,
                renderFunc,
            })
        }
    }))

    return {
        app,
        createApplication: app.ext.createApplication
    }
}
