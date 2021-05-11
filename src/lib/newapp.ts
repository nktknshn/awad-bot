import { pipe } from "fp-ts/lib/function";
import * as FL from "Lib/components/actions/flush";
import * as TR from "Lib/components/actions/tracker";
import { TelegrafContext } from "telegraf/typings/context";
import { Application, application, ChatState, defaultRenderScheme, genericRenderComponent } from "./application";
import * as CA from './chatactions';
import { ComponentElement } from "./component";
import { flushIfNeeded, FlushState } from "./components/actions/flush";
import { connectFStore } from "./components/actions/store";
import { UseTrackingRenderer } from "./components/actions/tracker";
import { applyActionEventReducer, makeEventReducer } from "./event";
import { ChatActionReducer, ChatStateAction, composeReducers, defaultReducer, ReducerFunction, reducerToFunction } from "./reducer";
import { StoreF2 } from "./storeF";
import { LocalStateAction } from "./tree2";
import { AppActionsFlatten, ApplicationUtil, BasicAppEvent, BuildApp, Defined, GetAllComps, GetState, GetStateDeps, RenderFunc, StateReq, Utils } from "./types-util";
// { store: StoreF2<unknown, unknown> }

export function attachStore<K extends keyof R,
    R extends Record<K, StoreF2<unknown, unknown>>>(key: K) {
    return function attachStore<H, Ext, RootComp>
        (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
        : Utils<R, H, BasicAppEvent<R, H>, Ext & {
            attachStore: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
        }, RootComp> {
        return a.extend(a => ({ attachStore: connectFStore(a, key) }))
    }

}

export type WithHandleEvent<R, H> = {
    handleEvent: (ctx: CA.ChatActionContext<R, H, BasicAppEvent<R, H>>, event: BasicAppEvent<R, H>) => Promise<ChatState<R, H>>;
}

export function handleEventExtension<Ext, R extends FlushState, H, RootComp>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
    : {
        handleEvent: (
            ctx: CA.ChatActionContext<R, H, BasicAppEvent<R, H>>,
            event: BasicAppEvent<R, H>) => Promise<ChatState<R, H>>;
    } {
    return {
        handleEvent: a.eventFunc(
            makeEventReducer(
                composeReducers(
                    applyActionEventReducer(),
                )
            ))
    }
}

type WithInit<R, H, Deps> = {
    init?: (deps: Deps) => CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
}
export function withInit<
    R extends FlushState & UseTrackingRenderer, H, Ext, RootComp>
    (f: (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>, ext: Ext) =>
        CA.AppChatAction<R, H, BasicAppEvent<R, H>>)
    : (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) =>
        Utils<R, H, BasicAppEvent<R, H>, Ext & WithInit<R, H, void>, RootComp> {
    return (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => a.extend(a => ({ init: () => f(a, a.ext) }))
}


export function props<P>(props: P) {
    return function <R, H, Ext, RootComp>
        (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
        : Utils<R, H, BasicAppEvent<R, H>, Ext & {
            props: P;
        }, RootComp> {
        return a.extend(_ => ({ props }))
    }
}

export function context<R, H, Ctx>(
    contextCreator: (cs: ChatState<R, H>) => Ctx) {
    return function withContextCreator<Ext, RootComp>
        (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
        : Utils<R, H, BasicAppEvent<R, H>, Ext & {
            contextCreator: (cs: ChatState<R, H>) => Ctx;
        }, RootComp> {
        return a.extend(_ => ({ contextCreator }))
    }
}

export function renderExtension<
    R, H, RootComp extends ComponentElement, P,
    Ctx extends StateReq<GetAllComps<RootComp>> = StateReq<GetAllComps<RootComp>>
>
    (a: Utils<R, H, BasicAppEvent<R, H>, WithComponent<P, RootComp>, RootComp>)
    : {
        render(contextCreator:
            (cs: ChatState<R, H>) => Ctx, props: P): RenderFunc<R, H>;
    } {
    return ({
        render(
            contextCreator: (cs: ChatState<R, H>) => Ctx,
            props: P
        ) {
            return a.renderFunc(
                genericRenderComponent(
                    defaultRenderScheme(), {
                    component: a.ext.component,
                    props,
                    contextCreator
                }))
        }
    })
}

export type WithComponent<P, R> = {
    component: (props: P) => R
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
    R, H, RootComp extends ComponentElement, P, Ctx, Ext
>
    (a: Utils<R, H, BasicAppEvent<R, H>,
        Ext & WithProps<P>
        & WithContextCreator<R, H, Ctx>
        & WithRender<R, H, P, Ctx>, RootComp>)
    : Utils<R, H, BasicAppEvent<R, H>,
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


export function withDefaultReducer<R, H, Ext, RootComp extends ComponentElement>(
    a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>>,
): {
    reducer: ChatActionReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | undefined,
        R, H, BasicAppEvent<R, H>>;
} {
    return { reducer: a.reducerFunc(defaultReducer()) }
}

export function addReducer<T1, T2, R, H, Ext, RootComp extends ComponentElement>(
    f: (a: Utils<R, H, BasicAppEvent<R, H>, WithReducer<T2, R, H> & Ext, RootComp>) =>
        ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>
) {
    return (a: Utils<R, H, BasicAppEvent<R, H>, WithReducer<T2, R, H> & Ext, RootComp>) =>
        a.extend(a => ({
            reducer: composeReducers(a.ext.reducer, f(a))
        }))
}

export function withActionReducer<R, H extends H1, Ext, RootComp extends ComponentElement, H1>(
    a: Utils<R, H, BasicAppEvent<R, H>, Ext & WithReducer<H1, R, H>, RootComp>,
): Utils<R, H, BasicAppEvent<R, H>,
    Ext
    & WithReducer<H1, R, H>
    & WithReducerFunction<R, H, H, BasicAppEvent<R, H>>,
    RootComp> {
    return a.extend(a => ({
        actionReducer: a.reducer(reducerToFunction(a.ext.reducer))
    }))
}

export function defaultBuild<
    R extends FlushState & UseTrackingRenderer,
    H, Ext, RootComp extends ComponentElement, P>
    (u: Utils<R, H, BasicAppEvent<R, H>,
        WithComponent<P, RootComp> & Ext,
        RootComp
    >) {
    return u.extend(handleEventExtension)
        .extend(renderExtension)
        .extend(withDefaultReducer)
}

export function complete<
    R, H extends H1, RootComp extends ComponentElement, P, Ctx, Ext, H1, T>
    (a: Utils<R, H, BasicAppEvent<R, H>,
        Ext & WithReducer<H1, R, H>
        & WithComponent<P, RootComp>
        & WithRender<R, H, P, Ctx>
        & WithContextCreator<R, H, Ctx>
        & WithProps<P>
        & WithState<T>
        // & BuildApp<T, P, RootComp>
        , RootComp>)
    : Utils<R, H, BasicAppEvent<R, H>,
        Ext & WithReducerFunction<R, H, H, BasicAppEvent<R, H>>
        & WithRenderFunc<R, H>
        & BuildApp<T, P, RootComp>
        , RootComp> {

    return pipe(
        a,
        withActionReducer,
        renderFuncExtension,
    )
}

export function extend<R, H, Ext, RootComp, RR>(f: (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => RR) {
    return function (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
        : Utils<R, H, BasicAppEvent<R, H>, Ext & RR, RootComp> {
        return a.extend(f)
    }
}

export function createApplication<
    R, H extends H1, RootComp extends ComponentElement, H1, Ext,
    T extends (d: any) => (tctx: TelegrafContext) => Promise<ChatState<R, H>>,
    InitDeps, StateDeps extends Parameters<T>[0] = Parameters<T>[0]>
    (a: Utils<R, H, BasicAppEvent<R, H>,
        & WithReducerFunction<R, H, H, BasicAppEvent<R, H>>
        & WithRenderFunc<R, H>
        & WithState<T>
        & WithInit<R, H, InitDeps>
        & WithHandleEvent<R, H>
        & Record<'handleMessage', CA.AppChatAction<R, H, BasicAppEvent<R, H>>>
        & Record<'handleAction', CA.AppChatAction<R, H, BasicAppEvent<R, H>>>
        & Ext
        , RootComp>)
    : Utils<R, H, BasicAppEvent<R, H>,
        Ext & Record<'createApplication', (deps: StateDeps & InitDeps) => Application<R, H, BasicAppEvent<R, H>>>
        , RootComp> {

    return pipe(a, extend(_ => ({
        createApplication: (deps: StateDeps & InitDeps): Application<R, H, BasicAppEvent<R, H>> => {
            const state = _.ext.state(deps)
            const actionReducer = _.ext.actionReducer
            const handleMessage = _.ext.handleMessage
            const handleAction = _.ext.handleAction
            const handleEvent = _.ext.handleEvent
            const renderFunc = _.ext.renderFunc

            return application({
                state,
                init: _.ext.init ?_.ext.init(deps) : undefined,
                actionReducer,
                handleMessage,
                handleAction,
                handleEvent,
                renderFunc,
            })
        }
    }))
    )
}
