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
import { Merge, BasicAppEvent, ComponentReqs, GetState, AppActionsFlatten } from "./types-util";
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

export const startBuild = <
    P,
    ReqContext extends ComponentReqs<RootComponent0>,
    RootComponent0, T,
    R = GetState<T>,
    H = AppActionsFlatten<RootComponent0>
>(component: (props: P) => RootComponent0, state: T): AppBuilder<R, H, WithComponent<P, ReqContext> & WithState<T>, ReqContext> => {
    type B = WithComponent<P, ReqContext> & WithState<T>;

    return ({
        action: F.identity,
        mapState: F.identity,
        mapState2: () => f => f,
        eventFunc: F.identity,
        actions: CA.sequence,
        extend<RR>(adds: (u: AppBuilder<R, H, B, ReqContext>) => RR): AppBuilder<R, H, Merge<B, RR>, ReqContext> {
            return createBuilder(merge({
                state,
                component: 'component',
                realfunc: component
            }, adds(this)));
        },
        extendF<RR>(adds: (u: AppBuilder<R, H, B, ReqContext>) => AppBuilder<R, H, Merge<B, RR>, ReqContext>): AppBuilder<R, H, Merge<B, RR>, ReqContext> {
            return adds(this);
        },
        extendState<RR>(adds: (u: AppBuilder<R, H, B, ReqContext>) => AppBuilder<R & RR, H, B, ReqContext>) {
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
// type Merge<T1 extends {}, T2 extends {}> = { [K1 in (keyof T1 | keyof T2)]: K1 extends keyof T2 ? T2[K1] : K1 extends keyof T1 ? T1[K1] : never }
// export type Merge<A, B> = A & B
// type Merge<T1 extends {}, T2 extends {}> = { [K1 in keyof T1]: T1[K1]} & T2
// type OA = Merge<Merge<{a: number}, {c: 1}>, {sasas: 1}>
// Object.keys(a)
// .filter(_ => Object.keys(b).indexOf(_) > -1)
// .reduce((acc, cur) => ({...acc, [cur]: a[cur]}))
// ({ ...a, ...b })

export function createBuilder<R, H, Ext, RootComponent>(
    ext: Ext
): AppBuilder<R, H, Ext, RootComponent> {
    return {
        action: F.identity,
        mapState: F.identity,
        mapState2: () => f => f,
        eventFunc: F.identity,
        actions: CA.sequence,
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
        reducerFunc: f => f
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
    actions: (fs: CA.AppChatAction<R, H, E>[]) => CA.AppChatAction<R, H, E>;
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
    reducer: <H1, H2>(f: ReducerFunction<R, H, H1, E>) => ReducerFunction<R, H, H1, E>;
    reducerFunc: <T1>(
        f: ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>) => ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>;

    renderFunc: (f: RenderFunc<R, H>) => RenderFunc<R, H>;
    extendState<RR>(adds: (u: AppBuilder<R, H, Ext, ReqContext>) => AppBuilder<R & RR, H, Ext, ReqContext>): AppBuilder<R & RR, H, Ext, ReqContext>;
}
export type Defined<T> = T extends (infer R) ? R extends undefined ? never : R : never;
