import { Component, ComponentConnected, ComponentElement, ComponentStateless, ComponentWithState, ConnectedComp } from "../lib/elements";


type GetCompGenerator<T> =
    T extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer R>
    ? R
    : T extends ComponentWithState<infer P, infer S, infer R>
    ? R
    : T extends ComponentStateless<infer P, infer R>
    ? R
    : never

type IsComp<T> = GetCompGenerator<T> extends never ? false : true

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