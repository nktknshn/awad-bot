import { ButtonElement, InputHandlerElement, WithContext } from "../lib/elements";
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

export type GetAllBasics<T> = T extends ComponentElement ? _GetAllBasics<GetCompGenerator<T>> : _GetAllBasics<T>

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

export type WithCallback<T extends (...args: any) => any, C> =
T extends (...args: infer P) => infer R1
? (P extends [...args: infer ARGS, arg: infer ARG]
    ? ARG extends (...args: infer P2) => infer R2
    ? (...args: [...ARGS, (a: C) => ARG]) => WithContext<C, R1> : never
    : never) : never

export type AddLastArgument<F extends (...args: any) => any, C> =
F extends (...args: infer ARGS) => infer R1
? (...args: [...ARGS, C]) => R1 : never

export type GetAllButtons<T> = GetAllBasics<T> extends infer B ? B extends ButtonElement<infer R> ? R : never : never
export type GetAllInputHandlers<T> = GetAllBasics<T> extends infer B ? B extends InputHandlerElement<infer R> ? R extends Matcher2<infer G> ? G : never : never : never
export type AppActions<T> = GetAllButtons<T> | GetAllInputHandlers<T>