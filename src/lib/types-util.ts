import { ButtonElement, ButtonsRowElement, EffectElement, InputHandlerElement, WithContext } from "../lib/elements";
import { Component, ComponentConnected, ComponentElement, ComponentStateless, ComponentWithState, ConnectedComp } from "./component";
import { InputHandler } from "./draft";
import { Matcher2 } from "./input";


export type GetCompGenerator<T> =
    T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer R>
    ? R
    : T extends ComponentWithState<infer P, infer S, infer R>
    ? R
    : T extends ComponentStateless<infer P, infer R>
    ? R
    : never

export type GenReturns<T> = T extends Generator<infer R, infer A, infer B> ? R : never

export type GetBasics<T> = T extends infer A ? A extends ComponentElement ? never : A : never
export type GetComps<T> = T extends infer A ? A extends ComponentElement ? A : never : never


type _GetAllBasics<Gen> =
    GenReturns<Gen> extends infer T
    ? T extends ComponentElement
    ? _GetAllBasics<GetCompGenerator<T>>
    : T
    : never

export type GetAllBasics<T> = T extends ComponentElement 
? _GetAllBasics<GetCompGenerator<T>> : T extends (P: infer P) => infer A ? GetAllBasics<A> : _GetAllBasics<T>

type _GetAllComps<Gen> =
    GenReturns<Gen> extends infer T
    ? T extends ComponentElement
    ? T | _GetAllComps<GetCompGenerator<T>>
    : _GetAllComps<T>
    : never

export type GetAllComps<T> = T extends ComponentElement ? T | _GetAllComps<GetCompGenerator<T>> : _GetAllComps<T>

export type GetRootStates<T> = T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer R> ? RootState : never

export type StatesKeys<A> = GetRootStates<A> extends infer T
    ? T extends { [K in keyof T]: T[K] }
    ? keyof T
    : never : never

export type FindKey<K, X> = X extends { [KK in keyof X]: X[KK] } ? K extends keyof X ? X[K] : never : never

export type StateReq<T> = GetRootStates<T> extends infer J ? { [K in StatesKeys<T>]: FindKey<K, J> } : never

export type AppReqs<A> = StateReq<GetAllComps<A>>

export type AddLastArgument<F extends (...args: any) => any, C> =
    F extends (...args: infer ARGS) => infer R1
    ? (...args: [...ARGS, C]) => R1 : never

export type GetAllButtons<T> = GetAllBasics<T> extends infer B ? B extends ButtonElement<infer R> ? R : never : never
export type GetButtonsRowElement<T> = GetAllBasics<T> extends infer B ? B extends ButtonsRowElement<infer R> ? R : never : never

export type GetAllInputHandlers<T> = Flatten<GetAllBasics<T> extends infer B ? B extends InputHandlerElement<infer R> ? B : never : never>

export type GetAllInputHandlersTypes<T> = Flatten<GetAllBasics<T> extends infer B ? B extends InputHandlerElement<infer R> ? R : never : never> extends infer R ? R extends Matcher2<infer G> ? G : never : never

export type _GetAllInputHandlers<T> = GetAllBasics<T> extends infer B ? B extends InputHandlerElement<infer R> ? R  extends Matcher2<infer G> ? G : never : never : never

export type GetAllEffects<T> = GetAllBasics<T> extends infer B ? B extends EffectElement<infer R> ? R : never : never

export type AppActions<T> = GetAllButtons<T> | GetAllInputHandlersTypes<T> | GetAllEffects<T> | GetButtonsRowElement<T>

export type Flatten<T> = T extends Array<infer Z> ? Flatten<Z> : T

export type _AppActionsFlatten<T> = AppActions<T> extends infer B ? Flatten<B> : never
export type AppActionsFlatten<T> = If<void, _AppActionsFlatten<T>, never, _AppActionsFlatten<T>>

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

export interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

export type DeepReadonlyObject<T> = {
    [K in keyof T]: DeepReadonly<T[K]>
}
