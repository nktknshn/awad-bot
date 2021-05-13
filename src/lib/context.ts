import { ChatState, getUserMessages } from "./chatstate";
import { ComponentConnected, isComponent } from "./component";

export const withUserMessages = <R, H>(c: ChatState<R, H>) => ({ userMessages: getUserMessages(c) });

export function makeContext<S1, R1>(
    fs: [(s: S1) => R1]
): <H>(s: S1) => ChatState<R1, H>
export function makeContext<S1, S2, R1, R2, >(
    fs: [
        (s: S1) => R1,
        (s: S2) => R2,

    ],
): <H>(s: S1 & S2 ) => ChatState<R1 & R2 , H>
export function makeContext<S1, S2, S3, R1, R2, R3>(
    fs: [
        (s: S1) => R1,
        (s: S2) => R2,
        (s: S3) => R3,

    ],
): <H>(s: S1 & S2 & S3) => ChatState<R1 & R2 & R3, H>
export function makeContext<S1, S2, S3, S4, R1, R2, R3, R4>(
    fs: [
        (s: S1) => R1,
        (s: S2) => R2,
        (s: S3) => R3,
        (s: S4) => R4,

    ],
): <H>(s: S1 & S2 & S3 & S4) => ChatState<R1 & R2 & R3 & R4, H>
export function makeContext(fs: ((s: any) => any)[]) {
    return (s: any) => {
        return fs.reduce((acc, cur) => ({...acc, ...cur(s)}), {})
    }
}

export type WithContext<
    K extends keyof any, C
    > =
    C extends (props: infer PP) => infer R
    ? R extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? (props: PP) => ComponentConnected<P, S, M, Record<K, RootState>, E, WithContext<K, E2>>
    : never
    : C extends ComponentConnected<infer P, infer S, infer M, infer RootState, infer E, infer E2>
    ? ComponentConnected<P, S, M, Record<K, RootState>, E, WithContext<K, E2>>
    : C


export function contextFromKey<
    K extends keyof any, P extends M, S, M, State, E, E2
>(
    key: K,
    comp: ComponentConnected<P, S, M, State, E, E2>
): ComponentConnected<P, S, M, Record<K, State>, E, WithContext<K, E2>> {
    return {
        ...comp,
        mapper: (ctx: Record<K, State>) => comp.mapper(ctx[key]),
        mapChildren: ((e: E) => isComponent(e) ? contextFromKey(key, e) : e) as any
    }
}

export function mapContext2<
    P extends M, S, M, State, E, E2, State2
>(
    f: (ctx: State2) => State,
    comp: ComponentConnected<P, S, M, State, E, E2>
): ComponentConnected<P, S, M, State2, E, E2> {
    return {
        ...comp,
        mapper: (ctx: State2) => comp.mapper(f(ctx)),
        // mapChildren: ((e: E) => isComponent(e) ? mapContext(key, e) : e) as any
    }
}

type Complete<T> = {
    [P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : (T[P] | undefined);
}
export const contextSelector = <Props>() => <K extends keyof Props>(
    ...keys: K[]
) => {
    const fromState = <R extends Props>(
        state: { [P in K]: R[P] }
    ): Complete<{ [P in K]: Props[P] }> =>
        keys.reduce((acc, cur) => ({ ...acc, [cur]: state[cur] }), {} as Complete<{
            [P in K]: Props[P]
        }>)

    const fromContext = <Ctx extends { [P in K]: Props[P] }>(context: Ctx) =>
        keys.reduce((acc, cur) => ({ ...acc, [cur]: context[cur] }), {} as { [P in K]: Props[P] })

    return {
        fromState,
        fromContext
    }
}
