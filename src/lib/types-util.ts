import { ButtonElement, ButtonsRowElement, EffectElement, InputHandlerElement, WithContext } from "../lib/elements";
import { Component, ComponentConnected, ComponentElement, ComponentGenerator, ComponentStateless, ComponentWithState, ConnectedComp } from "./component";
import { InputHandler } from "./draft";
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

// export type GetAllComps1<T> = GetComponent<T> extends infer R
//     ? GetCompGenerator<R> extends infer Children
//     ? Children extends infer C ?
//     C extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
//     ? ComponentConnected<P, never, {}, RootState, never, never> : never : never : never : never
export type MakeUnion<U> =
    If<U, {}, (U extends infer Z ? (k: Z) => void : never) extends ((k: infer I) => void) ? I : never, U>


export type GetAllComps<T> =
    T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
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
    { [K in StatesKeys<T>]: keyof Defined<FindKey<K, J>> extends never
        ? MakeUnion<FindKey<K, J>> : FindKey<K, J> } : never

// export type ComponentReqs<A> = StateReq<GetAllComps<A>>


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
// export type AppActionsFlatten<T> = If<void, _AppActionsFlatten<T>, never, _AppActionsFlatten<T>>

export type AppActionsFlatten<T> = Flatten<GetAllComps<T> extends infer B
    ? B extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? E extends infer EE
    ? EE extends ButtonElement<infer R> ? R
    : EE extends ButtonsRowElement<infer R> ? R
    : EE extends InputHandlerElement<infer R> ? R
    : EE extends EffectElement<infer R> ? R
    : never : never : never : never> extends infer R ? R extends Matcher2<infer G> ? Flatten<G> : R : never

export type IsFunction<T> = T extends (props: infer P) =>
    ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2> ? true : false

export type GetApp<T> = {
    Component: T extends (props: infer P) => infer R ?
    R extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2> ? R
    : never : T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E> ? T | GetApp<E> : never
}

export interface ComponentTypes<T> {
    isFunction: IsFunction<T>
    // comp: GetComponent<T>
    // props: GetProps<T>
    // actions: AppActionsFlatten<T>
    // elements: GetAllBasics<T>
    // comps: GetAllComps<T>
    // context: ComponentReqs<T>
    // rootState: GetRootState<GetComponent<T>>
    // actionsByElement: {
    //     buttons: GetAllButtons<T>
    //     input: GetAllInputHandlersTypes<T>
    //     effects: GetAllEffects<T>
    // }
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

import { ApplyActionsEvent } from "./event";
import { TelegrafContext } from "telegraf/typings/context";

// export type ApplicationUtil<R, H, E, T> = {
//     state: R,
//     action: H,
//     event: E
//     ChatContext: CA.ChatActionContext<R, H, E>,
//     ChatState: ChatState<R, H>
//     ChatAction: CA.AppChatAction<R, H, E>;
//     // Types: ComponentTypes<T>
//     // AppContext: ComponentReqs<T>
// }

export type BasicAppEvent<R, H> = ApplyActionsEvent<R, H, BasicAppEvent<R, H>>

export type StateConstructor<Deps, R> = (<H>(a: Deps) => (tctx: TelegrafContext) => Promise<ChatState<R, H>>)
// | ((tctx: TelegrafContext) => Promise<ChatState<R, H>>)

export type GetState<T> =
    T extends (a: infer Deps) => (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>> ? R
    : T extends (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>> ? R : never

export type GetStateDeps<T> =
    T extends (a: infer Deps) => (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>> ? Deps
    : T extends (...a: any[]) => Promise<ChatState<infer R, infer H>> ? R : void

export type GetChatState<T> =
    T extends (a: infer Deps) => (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>> ? ChatState<R, H> extends infer C ? { [K in keyof C]: C[K] } : never
    : T extends (tctx: TelegrafContext) => Promise<ChatState<infer R, infer H>>
    ? ChatState<R, H> extends infer C ? { [K in keyof C]: C[K] } : never : never

export type Merge<A, B> = A & B
// export type Merge<A, B> = Omit<A, keyof B> & B
// = {
//     [P in keyof A | keyof B]: P extends keyof B ? B[P] : P extends keyof A ? A[P] : never
// }


// type Merge<A, B> = {
//     [P in keyof A ]
// }
export type RequiredKeepUndefined<T> = { [K in keyof T]-?: [T[K]] } extends infer U
    ? U extends Record<keyof U, [any]> ? { [K in keyof U]: U[K][0] } : never
    : never;

import { ChatState } from "./chatstate";
import { Defined } from "./appbuilder";



