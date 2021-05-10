import { AppActionsFlatten, ApplicationUtil, BasicAppEvent, Defined, GetAllComps, GetChatState, GetState, Merge, RenderFunc, StateReq, Utils } from "./types-util"
import * as CA from './chatactions';
import { StoreF2 } from "./storeF";
import { addUserMessageIfNeeded, deferredRender, flushIfNeeded, FlushState } from "./components/actions/flush";
import { applyActionEventReducer, makeEventReducer } from "./event";
import { ChatActionReducer, ChatStateAction, composeMatchers2, composeReducers, DefaultActions, defaultReducer, extendReducerFunction, Reducer, ReducerFunction, reducerToFunction } from "./reducer";
import { connectFStore } from "./components/actions/store";
import { saveToTrackerAction, UseTrackingRenderer } from "./components/actions/tracker";
import { reloadInterface } from "./components/actions/misc";
import { ChatState, defaultRenderScheme, genericRenderComponent } from "./application";
import { ComponentElement } from "./component";
import { pipe } from "fp-ts/lib/function";
import { LocalStateAction } from "./tree2";

export function attachStore<R extends { store: StoreF2<unknown, unknown> }, H, Ext, RootComp>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>): Utils<R, H, BasicAppEvent<R, H>, Merge<Ext, {
        attachStore: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    }>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>> {
    return a.extend(a => ({ attachStore: connectFStore(a) }))
}

export function attachStoreExtensionA<R extends { store: StoreF2<unknown, unknown> }, H, Ext, RootComp>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) {
    return a.extend(attachStore)
}


export function handleActionExtension<R extends FlushState, H, Ext, RootComp>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>): {
        handleAction: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    } {
    return ({
        handleAction: a.actions([
            CA.applyActionHandler,
            CA.replyCallback,
            CA.applyEffects,
            CA.render,
            flushIfNeeded(),
        ])
    })
}

export function handleEventExtension<Ext, R extends FlushState, H, RootComp>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>): {
        handleEvent: (ctx: CA.ChatActionContext<R, H, BasicAppEvent<R, H>>, event: BasicAppEvent<R, H>) => Promise<ChatState<R, H>>;
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

export function initExtension<R extends FlushState & UseTrackingRenderer, H, Ext, RootComp, T extends any[]>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) {
    return (f: (...args: T) => CA.AppChatAction<R, H, BasicAppEvent<R, H>>) =>
        ({ init: (...args: T) => f(...args) })
}

export function withIni2t<
    R extends FlushState & UseTrackingRenderer, H, Ext, RootComp>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) {
    return (actions: CA.AppChatAction<R, H, BasicAppEvent<R, H>>) =>
        a.extend(a => ({ init: actions }))
}

export function withInit<
    R extends FlushState & UseTrackingRenderer, H, Ext, RootComp>
    (f: (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) =>
        CA.AppChatAction<R, H, BasicAppEvent<R, H>>)
    : (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => Utils<R, H, BasicAppEvent<R, H>, Merge<Ext, {
        init: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    }>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>> {
    return (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => a.extend(a => ({ init: f(a) }))
}


export function reducerExtension<R, H, Ext, RootComp>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) {
    return (reducer: AppReducerFunction<R, H>) =>
        ({ actionReducer: a.reducer(reducer) })
}

type AppReducerFunction<R, H> = (a: H | H[]) => CA.AppChatAction<R, H, BasicAppEvent<R, H>>[]

export function reducerExtension2<R, H>(reducer: AppReducerFunction<R, H>) {
    return function <Ext, RootComp>(a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) {
        return ({ actionReducer: a.reducer(reducer) })
    }
}

export function withProps<P>(props: P) {
    return function <R, H, Ext, RootComp>
        (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) {
        return a.extend(a => ({ props }))
    }
}

export function withContextCreator<R, H, Ctx>(
    contextCreator: (cs: ChatState<R, H>) => Ctx) {
    return function withContextCreator<Ext, RootComp>
        (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
        : Utils<R, H, BasicAppEvent<R, H>, Merge<Ext, {
            contextCreator: (cs: ChatState<R, H>) => Ctx;
        }>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>> {
        return a.extend(a => ({ contextCreator }))
    }
}

export function renderExtension<
    R, H, RootComp extends ComponentElement, P
>
    (a: Utils<R, H, BasicAppEvent<R, H>, WithComponent<P, RootComp>, RootComp>)
    : {
        render(contextCreator:
            (cs: ChatState<R, H>) => Defined<StateReq<GetAllComps<RootComp>>>, props: P): RenderFunc<R, H>;
    } {
    return ({
        render(
            contextCreator: (cs: ChatState<R, H>) => Defined<typeof a['AppContext']>,
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

type WithComponent<P, R> = {
    component: (props: P) => R
}

type WithRender<R, H, P, Ctx> = {
    render: (contextCreator: (cs: ChatState<R, H>) => Ctx, props: P) => RenderFunc<R, H>
}

type WithProps<P> = {
    props: P
}

type WithContextCreator<R, H, Ctx> = {
    contextCreator: (cs: ChatState<R, H>) => Ctx
}

export function renderFuncExtension<
    R, H, RootComp extends ComponentElement, P, Ctx, Ext
>
    (a: Utils<R, H, BasicAppEvent<R, H>,
        & WithProps<P>
        & WithContextCreator<R, H, Ctx>
        & WithRender<R, H, P, Ctx>
        & WithComponent<P, RootComp> & Ext
        , RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>>) {
    return a.extend(a => ({
        renderFunc: a.ext.render(a.ext.contextCreator, a.ext.props)
    }))
}

type WithReducerFunction<R, H1, H2, E> = {
    reducerFunction: ReducerFunction<R, H1, H2, E>
}

type WithReducer<T1, R, H,> = {
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

// export function addReducer11<T1, T2, R, H, Ext, RootComp extends ComponentElement>(
//     a: Utils<R, H, BasicAppEvent<R, H>, WithReducer<T2, R, H> & Ext, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>>,
//     reducer: ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>
// ) {
//     return a.extend(a => ({
//         reducer: composeReducers(a.ext.reducer, reducer)
//     }))
// }

export function addReducer<T1, T2, R, H, Ext, RootComp extends ComponentElement>(
    f: (a: Utils<R, H, BasicAppEvent<R, H>, WithReducer<T2, R, H> & Ext, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>>) =>
        ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>
) {
    return (a: Utils<R, H, BasicAppEvent<R, H>, WithReducer<T2, R, H> & Ext, RootComp>): Utils<R, H, BasicAppEvent<R, H>, Merge<WithReducer<T2, R, H> & Ext, {
        reducer: ChatActionReducer<T2 | T1, R, H, BasicAppEvent<R, H>>;
    }>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>>     =>
        a.extend(a => ({
            reducer: composeReducers(a.ext.reducer, f(a))
        }))
}


export function withActionReducer<R, H extends H1, Ext, RootComp extends ComponentElement, H1>(
    a: Utils<R, H, BasicAppEvent<R, H>, WithReducer<H1, R, H> & Ext, RootComp>,
) {
    return a.extend(a => ({
        actionReducer: a.reducer(reducerToFunction(a.ext.reducer))
    }))
}

export function defaultBuild<R extends FlushState & UseTrackingRenderer,
    H, Ext,
    RootComp extends ComponentElement, P>
    (u: Utils<R, H, BasicAppEvent<R, H>, WithComponent<P, RootComp> & Ext, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>>) {
    return u.extend(handleEventExtension)
        .extend(handleActionExtension)
        .extend(renderExtension)
        .extend(withDefaultReducer)
}

export function complete<
    R, H extends H1, RootComp extends ComponentElement, P, Ctx, Ext, H1
>
    (a: Utils<R, H, BasicAppEvent<R, H>,
        & WithProps<P>
        & WithContextCreator<R, H, Ctx>
        & WithRender<R, H, P, Ctx>
        & WithComponent<P, RootComp>
        & WithReducer<H1, R, H>
        & Ext
        , RootComp>) {
    return pipe(
        a,
        withActionReducer,
        renderFuncExtension
    )
}

export function extend<R, H, Ext, RootComp, RR>(f: (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => RR) {
    return function (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
        : Utils<R, H, BasicAppEvent<R, H>, Merge<Ext, RR>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>> {
        return a.extend(f)
    }
}
