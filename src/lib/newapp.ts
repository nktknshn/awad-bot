import { pipe } from "fp-ts/lib/function";
import * as FL from "Lib/components/actions/flush";
import * as TR from "Lib/components/actions/tracker";
import { ChatState, defaultRenderScheme, genericRenderComponent } from "./application";
import * as CA from './chatactions';
import { ComponentElement } from "./component";
import { flushIfNeeded, FlushState } from "./components/actions/flush";
import { connectFStore } from "./components/actions/store";
import { UseTrackingRenderer } from "./components/actions/tracker";
import { applyActionEventReducer, makeEventReducer } from "./event";
import { ChatActionReducer, ChatStateAction, composeReducers, defaultReducer, ReducerFunction, reducerToFunction } from "./reducer";
import { StoreF2 } from "./storeF";
import { LocalStateAction } from "./tree2";
import { ApplicationUtil, BasicAppEvent, Defined, GetAllComps, Merge, RenderFunc, StateReq, Utils } from "./types-util";
// { store: StoreF2<unknown, unknown> }

export function attachStore<K extends keyof R,
    R extends Record<K, StoreF2<unknown, unknown>>>(key: K) {
    return function attachStore<H, Ext, RootComp>
        (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
        : Utils<R, H, BasicAppEvent<R, H>, Merge<Ext, {
            attachStore: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
        }>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>> {
        return a.extend(a => ({ attachStore: connectFStore(a, key) }))
    }

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


export function withInit<
    R extends FlushState & UseTrackingRenderer, H, Ext, RootComp>
    (f: (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>, ext: Ext) =>
        CA.AppChatAction<R, H, BasicAppEvent<R, H>>)
    : (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => Utils<R, H, BasicAppEvent<R, H>, Merge<Ext, {
        init: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    }>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>> {
    return (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => a.extend(a => ({ init: f(a, a.ext) }))
}


export function props<P>(props: P) {
    return function <R, H, Ext, RootComp>
        (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
        : Utils<R, H, BasicAppEvent<R, H>, Merge<Ext, {
            props: P;
        }>, RootComp> {
        return a.extend(_ => ({ props }))
    }
}

export function context<R, H, Ctx>(
    contextCreator: (cs: ChatState<R, H>) => Ctx) {
    return function withContextCreator<Ext, RootComp>
        (a: Utils<R, H, BasicAppEvent<R, H>, Ext, RootComp>)
        : Utils<R, H, BasicAppEvent<R, H>, Merge<Ext, {
            contextCreator: (cs: ChatState<R, H>) => Ctx;
        }>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>> {
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

export type WithRender<R, H, P, Ctx> = {
    render: (contextCreator: (cs: ChatState<R, H>) => Ctx, props: P) => RenderFunc<R, H>
}

export type WithProps<P> = {
    props: P
}

export type WithContextCreator<R, H, Ctx> = {
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
        , RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>>): Utils<R, H, BasicAppEvent<R, H>, Merge<WithProps<P> & WithContextCreator<R, H, Ctx> & WithRender<R, H, P, Ctx> & WithComponent<P, RootComp> & Ext, {
            renderFunc: RenderFunc<R, H>;
        }>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>> {
    return a.extend(a => ({
        renderFunc: a.ext.render(a.ext.contextCreator, a.ext.props)
    }))
}

type WithReducerFunction<R, H1, H2, E> = {
    reducerFunction: ReducerFunction<R, H1, H2, E>
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
    f: (a: Utils<R, H, BasicAppEvent<R, H>, WithReducer<T2, R, H> & Ext, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>>) =>
        ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>
) {
    return (a: Utils<R, H, BasicAppEvent<R, H>, WithReducer<T2, R, H> & Ext, RootComp>): Utils<R, H, BasicAppEvent<R, H>, Merge<WithReducer<T2, R, H> & Ext, {
        reducer: ChatActionReducer<T2 | T1, R, H, BasicAppEvent<R, H>>;
    }>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>> =>
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
