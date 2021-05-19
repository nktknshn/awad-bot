import { Effect } from "./draft";
import * as CA from 'Lib/chatactions';
import * as F from 'fp-ts/lib/function';
import { ChatRenderer } from "./chatrenderer";
import { ChatActionReducer, ReducerFunction } from "./reducer";
import { WithComponent, WithState } from "./newapp";
import * as A from 'fp-ts/lib/Array';
import { pipe } from "fp-ts/lib/pipeable";
import { eqString } from "fp-ts/lib/Eq";
import { ChatState } from "./chatstate";
import { Merge, BasicAppEvent, ComponentReqs, GetState, AppActionsFlatten, StateConstructor } from "./types-util";
import * as AP from 'Lib/newapp';

const merge = <A, B>(a: A, b: B): Merge<A, B> => {
    const bs = pipe(
        Object.keys(b),
        A.filter((k: keyof any): k is keyof B => true),
        A.map((k) => [k, b[k]] as const)
    );

    const as = pipe(
        A.difference(eqString)(Object.keys(a), Object.keys(b)),
        A.filter((k: keyof any): k is keyof A => true),
        A.map((k) => [k, a[k]] as const));

    return pipe(
        [...as, ...bs],
        A.reduce({} as Merge<A, B>, (acc, [k, v]) => ({ ...acc, [k]: v }))
    );
};

export const gettype = <RootComp, Ext, R, H>(a: AppBuilder<R, H, BasicAppEvent<R, H>, Ext, RootComp>) => a;

export const finishBuild = () => AP.complete


export const startBuild0 = <
    ReqContext = unknown, H = unknown, R = unknown
>(): AppBuilder<R, H, {}, ReqContext> => {
    type B = {};

    return ({
        action: F.identity,
        mapState: F.identity,
        mapState2: () => f => f,
        eventFunc: F.identity,
        sequence: CA.sequence,
        extend<RR>(adds: (u: AppBuilder<R, H, B, ReqContext>) => RR): AppBuilder<R, H, Merge<B, RR>, ReqContext> {
            return createBuilder(merge({}, adds(this)));
        },
        extendF<RR>(adds: (u: AppBuilder<R, H, B, ReqContext>) => AppBuilder<R, H, Merge<B, RR>, ReqContext>): AppBuilder<R, H, Merge<B, RR>, ReqContext> {
            return adds(this);
        },
        // extendFF<RR, R1, H1>(adds: (u: AppBuilder<R, H, B, ReqContext>) => 
        // AppBuilder<R1, H1, Merge<B, RR>, ReqContext>): AppBuilder<R1, H1, Merge<B, RR>, ReqContext> {
        //     return adds(this);
        // },
        extendState<RR>(adds: (u: AppBuilder<R, H, B, ReqContext>) => AppBuilder<R & RR, H, B, ReqContext>) {
            return adds(this);
        },
        actionF: f => f(),
        actionFF: (f) => (...args) => f(...args),
        ext: {},
        reducer: f => f,
        renderFunc: f => f,
        reducerFunc: f => f
    })
}


export const startBuild = <
    Props, ContextReq extends ComponentReqs<RootComponent0>,
    RootComponent0, T extends StateConstructor<Deps, R>,
    Deps, R, H,
    >(component: <A>(props: Props) => RootComponent0, state: StateConstructor<Deps, R>)
    : AppBuilder<R, H, WithComponent<Props, ContextReq>
        & WithState<R, Deps>, ContextReq> => {

    type B = WithComponent<Props, ContextReq> & WithState<R, Deps>;

    return ({
        action: F.identity,
        mapState: F.identity,
        mapState2: () => f => f,
        eventFunc: F.identity,
        sequence: CA.sequence,
        extend<RR>(adds: (u: AppBuilder<R, H, B, ContextReq>) => RR): AppBuilder<R, H, Merge<B, RR>, ContextReq> {
            return createBuilder(merge({
                state,
                component: 'component',
                realfunc: component
            }, adds(this)));
        },
        extendF<RR>(adds: (u: AppBuilder<R, H, B, ContextReq>) => AppBuilder<R, H, Merge<B, RR>, ContextReq>): AppBuilder<R, H, Merge<B, RR>, ContextReq> {
            return adds(this);
        },
        extendState<RR>(adds: (u: AppBuilder<R, H, B, ContextReq>) => AppBuilder<R & RR, H, B, ContextReq>) {
            return adds(this);
        },
        actionF: f => f(),
        actionFF: (f) => (...args) => f(...args),
        ext: { state, component: 'component', realfunc: component as any },
        reducer: f => f,
        renderFunc: f => f,
        reducerFunc: f => f
    });
};

export function createBuilder<R, H, Ext, RootComponent>(
    ext: Ext
): AppBuilder<R, H, Ext, RootComponent> {
    return {
        action: F.identity,
        mapState: F.identity,
        mapState2: () => f => f,
        eventFunc: F.identity,
        sequence: CA.sequence,
        extend<RR>(adds: (u: AppBuilder<R, H, Ext, RootComponent>) => RR): AppBuilder<R, H, Merge<Ext, RR>, RootComponent> {
            return createBuilder(merge(ext, adds(this)));
        },
        extendF<RR>(adds: (u: AppBuilder<R, H, Ext, RootComponent>) => AppBuilder<R, H, Merge<Ext, RR>, RootComponent>): AppBuilder<R, H, Merge<Ext, RR>, RootComponent> {
            return adds(this);
        },
        extendState<RR>(adds: (u: AppBuilder<R, H, Ext, RootComponent>) => AppBuilder<R & RR, H, Ext, RootComponent>) {
            return adds(this);
        },
        actionF: f => f(),
        actionFF: (f) => (...args) => f(...args),
        ext,
        reducer: f => f,
        renderFunc: f => f,
        reducerFunc: f => f,
        // , Types
    };
}

export type RenderFunc<R, H> = (state: ChatState<R, H>) => {
    chatdata: ChatState<R, H>;
    renderFunction: (renderer: ChatRenderer) => Promise<ChatState<R, H>>;
    effects: Effect<H>[];
};

export interface AppBuilder<R, H, Ext, ReqContext, E = BasicAppEvent<R, H>
    // A extends ApplicationUtil<R, H, RootComp> = ApplicationUtil<R, H, RootComp>
    > {
    action: (f: CA.AppChatAction<R, H, E>) => CA.AppChatAction<R, H, E>;
    actionF: (f: () => CA.AppChatAction<R, H, E>) => CA.AppChatAction<R, H, E>;
    actionFF: <T extends any[]>(f: (...args: T) => CA.AppChatAction<R, H, E>) =>
        (...args: T) => CA.AppChatAction<R, H, E>;
    sequence: (fs: CA.AppChatAction<R, H, E>[]) => CA.AppChatAction<R, H, E>;
    mapState: <R>(f: (s: ChatState<R, H>) => R) => (s: ChatState<R, H>) => R;
    mapState2: <S>() => <R>(f: (s: S) => R) => (s: S) => R;
    eventFunc: (handleEvent: (
        ctx: CA.ChatActionContext<R, H, E>,
        event: E
    ) => Promise<ChatState<R, H>>) => typeof handleEvent;
    extend<RR>(adds: (u: AppBuilder<R, H, Ext, ReqContext>) => RR): AppBuilder<R, H, Merge<Ext, RR>, ReqContext>;
    extendF<RR>(
        adds: (u: AppBuilder<R, H, Ext, ReqContext>) => AppBuilder<R, H, Merge<Ext, RR>, ReqContext>
    ): AppBuilder<R, H, Merge<Ext, RR>, ReqContext>;
    ext: Ext;
    // with<RR>(adds: (u: AppBuilder<R, H, Ext, RootComp>) => RR): AppBuilder<R, H, Merge<Ext, RR>, RootComp>;
    reducer: <H1>(f: ReducerFunction<R, H, H1, E>) => ReducerFunction<R, H, H1, E>;
    reducerFunc: <T1>(
        f: ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>) => ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>;

    renderFunc: (f: RenderFunc<R, H>) => RenderFunc<R, H>;
    extendState<RR>(adds: (u: AppBuilder<R, H, Ext, ReqContext>) => AppBuilder<R & RR, H, Ext, ReqContext>): AppBuilder<R & RR, H, Ext, ReqContext>;
}
export type Defined<T> = T extends (infer R) ? R extends undefined ? never : R : never;
