import { Lens } from "monocle-ts";
import { mylog } from "./logging";
import { RequiredKeepUndefined } from "./types-util";


type LensObject<S> = {
    [k in keyof S]-?: Lens<S, S[k]>
}

export function storef<S extends {}>(initial: RequiredKeepUndefined<S>): StoreF2<S, StoreAction<S>> {
    return new Store2F<S>(initial)
}

// true
type Z1 = 1 & 2 extends 1 ? true : false
// false
type Z0 = 1 extends 1 & 2 ? true : false

// false
type Z2 = 1 | 2 extends 1 ? true : false
// true
type Z3 = 1 extends 1 | 2 ? true : false

export interface StoreF2<S, H = StoreAction<S>> {
    applyAction(a: H): StoreF2<S, H>
    state: S
    dispatch: <SS extends H>(a: SS) => void
    withDispatch: (f: (a: any) => void) => StoreF2<S, H>
}

// export type ComposeStores<S1, S2> = 
// S1 extends StoreF2<infer _S1, infer _H1>
// ? S2 extends StoreF2<infer _S2, infer _H2>
// ? ComposedStore<_S1 & _S2, _H1 | _H2> : never : never

export type ComposeStores<S1, S2, S3 = {}, S4 = {}, S5 = {}, S6 = {}> =
    ComposedStore<S1 & S2 & S3 & S4 & S5 & S6,
        StoreAction<S1> | StoreAction<S2> 
        | StoreAction<S4> | StoreAction<S4> | StoreAction<S5> | StoreAction<S6>
>

export type ComposedStore<S, H> = StoreF2<S, H>

export function composeStores<S1, S2>(
    ss: [StoreF2<S1, StoreAction<S1>>, StoreF2<S2, StoreAction<S2>>],
): ComposedStore<S1 & S2, StoreAction<S1> | StoreAction<S2>>
export function composeStores<S1, S2, S3>(
    ss: [StoreF2<S1, StoreAction<S1>>, StoreF2<S2, StoreAction<S2>>, StoreF2<S3, StoreAction<S3>>]
): ComposedStore<S1 & S2 & S3, StoreAction<S1> | StoreAction<S2> | StoreAction<S3>>
export function composeStores<S1, S2, S3, S4>(
    ss: [StoreF2<S1, StoreAction<S1>>, StoreF2<S2, StoreAction<S2>>,
        StoreF2<S3, StoreAction<S3>>, StoreF2<S4, StoreAction<S4>>]
): ComposedStore<S1 & S2 & S3, StoreAction<S1> | StoreAction<S2> | StoreAction<S3> | StoreAction<S4>>
export function composeStores(ss: StoreF2<any, any>[]): ComposedStore<any, any> {

    const state = ss.map(_ => _.state).reduce((acc, cur) => ({ ...acc, ...cur }), {})

    return new Store2F<any>(state) as ComposedStore<any, any> 
}

export class Store2F<S> implements StoreF2<S,StoreAction<S>>{
    state: Readonly<S>

    constructor(initial: S, dispatch = <SS extends StoreAction<S>>(a: SS) => { mylog("set notify function"); }) {
        this.state = { ...initial }
        this.dispatch = dispatch
    }

    applyAction(a: StoreAction<S>): StoreF2<S, StoreAction<S>>{
        return new Store2F<S>(
            a.f(this.state), this.dispatch
        )
    }

    public dispatch = <SS extends StoreAction<S>>(a: SS) => { mylog("set notify function"); }
    public withDispatch = (d: (a: StoreAction<S>) => void) => {
        const n = new Store2F(this.state, d)
        return n
    };
}

export interface StoreF<S> {
    map(f: (u: S) => S): StoreF<S>
    state: Readonly<S>
}

export class StoreF<S extends {}> implements StoreF2<S, StoreAction<S>> {
    state: Readonly<S>
    constructor(initial: S) {
        this.state = { ...initial }
    }

    public dispatch = <SS extends StoreAction<S>>(a: SS) => { mylog("set notify function"); }

    public withDispatch = (d: (a: StoreAction<S>) => void) => {
        const n = new StoreF(this.state)
        n.dispatch = d
        return n
    };

    map(f: (u: S) => S): StoreF<S> {
        const n = new StoreF(f(this.state))
        return n
    }

    lens(): LensObject<S> {
        return Object.keys(this.state)
            .map(k => [k, Lens.fromProp<any>()(k)] as const)
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}) as any
    }

    applyAction(a: StoreAction<S>): StoreF2<S, StoreAction<S>> {
        return this.map(a.f)
    }
}

export function createStoreF<S>(initial: S) {
    return {
        store: new StoreF(initial)
    }
}

export function lens<S>(store: StoreF2<S, StoreAction<S>>): LensObject<S> {
    return Object.keys(store.state)
        .map(k => [k, Lens.fromProp<any>()(k)] as const)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}) as any
}


// export interface StoreAction<S> {
//     kind: 'store-action',
//     f: (s: S) => S
// }

export interface StoreAction<S> {
    kind: 'store-action',
    f: (s: S) => S
}

export const storeAction = <T extends any[], S>(
    f: (...args: T) => (s: S) => S): (...args: T) => StoreAction<S> => (...args) =>
    ({
        kind: 'store-action' as 'store-action',
        f: f(...args)
    })

// export const storeAction2 = <T extends any[], S>(
//     f: (...args: T) => (s: S) => S): (...args: T) => StoreAction2 => (...args) =>
//     ({
//         kind: 'store-action' as 'store-action',
//         f: f(...args)
//     })

// export interface StoreAction2 {
//     kind: 'store-action',
//     f: <S>(s: S) => S
// }