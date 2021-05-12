import { ButtonElement, ButtonsRowElement, EffectElement, InputHandlerElement, WithContext } from "../lib/elements";
import { ChatState } from "./application";
import { Component, ComponentConnected, ComponentElement, ComponentGenerator, ComponentStateless, ComponentWithState, ConnectedComp } from "./component";
import { Effect, InputHandler } from "./draft";
import { Matcher2 } from "./input";

export type GetProps<T> = T extends (props: infer P) => infer R ? P : never

export type GetComponent<T> = T extends (props: infer P) => infer R ?
    R extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2> ? R
    : never : T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E> ? T : never

export type GetCompGenerator<T> =
    T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? E2
    : never

export type _GetAllBasics<Gen> =
    Gen extends infer T
    ? T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? _GetAllBasics<GetCompGenerator<T>>
    : T
    : never

export type GetAllBasics<T> =
    T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? _GetAllBasics<E2>
    : T extends (P: infer P) => infer A ? GetAllBasics<A> : never

export type GetAllComps1<T> = GetComponent<T> extends infer R
    ? GetCompGenerator<R> extends infer Children
    ? Children extends infer C ?
    C extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? ComponentConnected<P, never, {}, RootState, never, never> : never : never : never : never

export type GetAllComps<T> = T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? T | _GetAllComps<E2> : T extends (P: infer P) => infer A ? _GetAllComps<A> : _GetAllComps<T>

export type _GetAllComps<T> =
    T extends infer B ? B extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? B | _GetAllComps<E2> : never : never

export type GetRootState<T> =
    T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? RootState : never

export type StatesKeys<A> = GetRootState<A> extends infer T
    ? T extends { [K in keyof T]: T[K] }
    ? keyof T
    : never : never

export type FindKey<K, X> = X extends { [KK in keyof X]: X[KK] }
    ? K extends keyof X ? X[K] : never : never

export type StateReq<T> = GetRootState<T> extends infer J ?
    { [K in StatesKeys<T>]: FindKey<K, J> } : never

export type ComponentReqs<A> = StateReq<GetAllComps<A>>

export type AddLastArgument<F extends (...args: any) => any, C> =
    F extends (...args: infer ARGS) => infer R1
    ? (...args: [...ARGS, C]) => R1 : never

export type GetAllButtons<T> = Flatten<GetAllBasics<T> extends infer B ? B extends ButtonElement<infer R> ? R : never : never>
export type GetButtonsRowElement<T> = GetAllBasics<T> extends infer B ? B extends ButtonsRowElement<infer R> ? R : never : never

export type GetAllInputHandlers<T> = Flatten<GetAllBasics<T> extends infer B ? B extends InputHandlerElement<infer R> ? B : never : never>

export type GetAllInputHandlersTypes<T> = Flatten<GetAllBasics<T> extends infer B
    ? B extends InputHandlerElement<infer R> ? R : never : never> extends infer R ? R extends Matcher2<infer G> ? G : never : never

export type _GetAllInputHandlers<T> = GetAllBasics<T> extends infer B ? B extends InputHandlerElement<infer R>
    ? R extends Matcher2<infer G> ? G : never : never : never

export type GetAllEffects<T> = GetAllBasics<T> extends infer B ? B extends EffectElement<infer R> ? R : never : never

export type AppActions<T> = GetAllButtons<T> | GetAllInputHandlersTypes<T> | GetAllEffects<T> | GetButtonsRowElement<T>

export type Flatten<T> = T extends Array<infer Z> ? Flatten<Z> : T

export type _AppActionsFlatten<T> = AppActions<T> extends infer B ? Flatten<B> : never
export type AppActionsFlatten<T> = If<void, _AppActionsFlatten<T>, never, _AppActionsFlatten<T>>

export type IsFunction<T> = T extends (props: infer P) =>
    ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2> ? true : false

export interface ComponentTypes<T> {
    isFunction: IsFunction<T>
    comp: GetComponent<T>
    props: GetProps<T>
    actions: AppActionsFlatten<T>
    elements: GetAllBasics<T>
    comps: GetAllComps<T>
    context: ComponentReqs<T>
    rootState: GetRootState<GetComponent<T>>
    actionsByElement: {
        buttons: GetAllButtons<T>
        input: GetAllInputHandlersTypes<T>
        effects: GetAllEffects<T>
    }
}

/**
 * https://github.com/YBogomolov/talk-typelevel-ts
 * 
 * Conditional: if `T` extends `U`, then returns `True` type, otherwise `False` type
 */
export type If<T, U, True, False> = [T] extends [U] ? True : False;
/**
 * If `T` is defined (not `never`), then resulting type is equivalent to `True`, otherwise to `False`.
 */

export type IfDef<T, True, False> = If<T, never, False, True>;
/**
 * If `MaybeNever` type is `never`, then a `Fallback` is returned. Otherwise `MaybeNever` type is returned as is.
 */

export type OrElse<MaybeNever, Fallback> = IfDef<MaybeNever, MaybeNever, Fallback>;

export type DeepReadonly<T> =
    T extends any[] ? DeepReadonlyArray<T[number]> :
    T extends object ? DeepReadonlyObject<T> :
    T;

export interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> { }

export type DeepReadonlyObject<T> = {
    [K in keyof T]: DeepReadonly<T[K]>
}

import * as CA from 'Lib/chatactions'
import * as F from 'fp-ts/lib/function'
import { ApplyActionsEvent } from "./event";
import { ChatRenderer } from "./chatrenderer";
import { ChatActionReducer, ReducerFunction } from "./reducer";
import { TelegrafContext } from "telegraf/typings/context";
import { WithComponent, WithState } from "./newapp";

export type ApplicationUtil<R, H, E, T> = {
    state: R,
    action: H,
    event: E
    ChatContext: CA.ChatActionContext<R, H, E>,
    ChatState: ChatState<R, H>
    ChatAction: CA.AppChatAction<R, H, E>;
    // Types: ComponentTypes<T>
    AppContext: ComponentReqs<T>
}

export type BasicAppEvent<R, H> = ApplyActionsEvent<R, H, BasicAppEvent<R, H>>

export type GetState<T> =
    T extends (a: infer Deps) => (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>> ? R
    : T extends (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>> ? R : never

export type GetStateDeps<T> =
    T extends (a: infer Deps) => (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>> ? Deps
    : T extends (...a: any[]) => Promise<ChatState<infer R, infer H>> ? R : void

export type GetChatState<T> =
    T extends (a: infer Deps) => (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>> ? ChatState<R, H>
    : T extends (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>> ? ChatState<R, H> : never

export type Merge<A, B> = A & B
// export type Merge<A, B> = Omit<A, keyof B> & B
// = {
//     [P in keyof A | keyof B]: P extends keyof B ? B[P] : P extends keyof A ? A[P] : never
// }


// type Merge<A, B> = {
//     [P in keyof A ]
// }

import * as A from 'fp-ts/lib/Array'
import { pipe } from "fp-ts/lib/pipeable";
import { eqString } from "fp-ts/lib/Eq";


const merge = <A, B>(a: A, b: B): Merge<A, B> =>
// : Merge<A, B> => 
{
    const bs = pipe(
        Object.keys(b)
        , A.filter((k: keyof any): k is keyof B => true)
        , A.map((k) => [k, b[k]] as const)
    )

    const as = pipe(
        A.difference(eqString)(Object.keys(a), Object.keys(b))
        , A.filter((k: keyof any): k is keyof A => true)
        , A.map((k) => [k, a[k]] as const))

    return pipe(
        [...as, ...bs]
        , A.reduce({} as Merge<A, B>, (acc, [k, v]) => ({ ...acc, [k]: v }))
    )
}
export const buildApp = <
    RootComponent extends ComponentElement,
    H extends AppActionsFlatten<RootComponent>,
    P, T, R = GetState<T>, E = BasicAppEvent<R, H>,
    >(component: (props: P) => RootComponent, state: T)
    : Utils<R, H, E, WithComponent<P, RootComponent> & WithState<T>, RootComponent> => {

    type B = WithComponent<P, RootComponent> & WithState<T>

    return ({
        action: F.identity,
        mapState: F.identity,
        mapState2: () => f => f,
        eventFunc: F.identity,
        actions: CA.sequence,
        extend<RR>(adds: (u: Utils<R, H, E, B, RootComponent>) => RR)
            : Utils<R, H, E, Merge<B, RR>, RootComponent> {
            return createUtils(merge({ state, component }, adds(this)))
        }
        , extendF<RR>(adds: (u: Utils<R, H, E, B, RootComponent>) =>
            Utils<R, H, E, Merge<B, RR>, RootComponent>)
            : Utils<R, H, E, Merge<B, RR>, RootComponent> {
            return adds(this)
        }
        , extendState<RR>(adds: (u: Utils<R, H, E, B, RootComponent>) =>
            Utils<R & RR, H, E, B, RootComponent>) {
            return adds(this)
        }
        , actionF: f => f()
        , actionFF: (f) => (...args) => f(...args)
        , ext: { state, component }
        , reducer: f => f
        , renderFunc: f => f
        , reducerFunc: f => f
    })
}

// type Merge<T1 extends {}, T2 extends {}> = { [K1 in (keyof T1 | keyof T2)]: K1 extends keyof T2 ? T2[K1] : K1 extends keyof T1 ? T1[K1] : never }

// export type Merge<A, B> = A & B

// type Merge<T1 extends {}, T2 extends {}> = { [K1 in keyof T1]: T1[K1]} & T2

// type OA = Merge<Merge<{a: number}, {c: 1}>, {sasas: 1}>


// Object.keys(a)
// .filter(_ => Object.keys(b).indexOf(_) > -1)
// .reduce((acc, cur) => ({...acc, [cur]: a[cur]}))
// ({ ...a, ...b })

export function createUtils<R, H, E, Ext, RootComponent>(
    ext: Ext
): Utils<R, H, E, Ext, RootComponent> {
    return {
        action: F.identity,
        mapState: F.identity,
        mapState2: () => f => f,
        eventFunc: F.identity,
        actions: CA.sequence,
        extend<RR>(adds: (u: Utils<R, H, E, Ext, RootComponent>) => RR)
            : Utils<R, H, E, Merge<Ext, RR>, RootComponent> {
            return createUtils(merge(ext, adds(this)))
        },
        extendF<RR>(adds: (u: Utils<R, H, E, Ext, RootComponent>) => Utils<R, H, E, Merge<Ext, RR>, RootComponent>)
            : Utils<R, H, E, Merge<Ext, RR>, RootComponent> {
            return adds(this)
        },
        extendState<RR>(adds: (u: Utils<R, H, E, Ext, RootComponent>) => Utils<R & RR, H, E, Ext, RootComponent>) {
            return adds(this)
        },
        actionF: f => f()
        , actionFF: (f) => (...args) => f(...args)
        , ext
        , reducer: f => f
        , renderFunc: f => f
        , reducerFunc: f => f
        // , Types
    }
}

export type RenderFunc<R, H> = (state: ChatState<R, H>) => {
    chatdata: ChatState<R, H>;
    renderFunction: (renderer: ChatRenderer) => Promise<ChatState<R, H>>;
    effects: Effect<H>[]
}

export interface Utils<R, H, E, Ext, RootComp,
    A extends ApplicationUtil<R, H, E, RootComp> = ApplicationUtil<R, H, E, RootComp>> {
    action: (f: A['ChatAction']) => A['ChatAction'],
    actionF: (f: () => A['ChatAction']) => A['ChatAction'],
    actionFF: <T extends any[]>(f: (...args: T) => A['ChatAction']) => (...args: T) => A['ChatAction'],
    actions: (fs: A['ChatAction'][]) => A['ChatAction'],
    mapState: <R>(f: (s: A['ChatState']) => R) => (s: A['ChatState']) => R,
    mapState2: <S>() => <R>(f: (s: S) => R) => (s: S) => R,
    eventFunc: (handleEvent: (
        ctx: A['ChatContext'],
        event: E
    ) => Promise<ChatState<R, H>>) => typeof handleEvent,
    extend<RR extends {}>(adds: (u: Utils<R, H, E, Ext, RootComp>) => RR)
        : Utils<R, H, E, Merge<Ext, RR>, RootComp>
    extendF<RR extends {}>(
        adds: (u: Utils<R, H, E, Ext, RootComp>) => Utils<R, H, E, Merge<Ext, RR>, RootComp>
    ): Utils<R, H, E, Merge<Ext, RR>, RootComp>
    ext: Ext
    reducer: <H1, H2>(f: ReducerFunction<R, H, H1, E>) => ReducerFunction<R, H, H1, E>
    reducerFunc: <T1 >(
        f: ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>) =>
        ChatActionReducer<T1, R, H, BasicAppEvent<R, H>>

    renderFunc: (f: RenderFunc<R, H>) => RenderFunc<R, H>
    extendState<RR>(adds: (u: Utils<R, H, E, Ext, RootComp>) => Utils<R & RR, H, E, Ext, RootComp>)
        : Utils<R & RR, H, E, Ext, RootComp>
    A?: A
    // Context?: A['ChatContext']
    // State?: ChatState<A['state'], A['action']>
    // Types?: A['Types']
    // AppContext?: A['AppContext']
}
export type Defined<T> = T extends (infer R) ? R extends undefined ? never : R : never

