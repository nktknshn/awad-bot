import * as A from 'fp-ts/lib/Array'
import * as CA from './chatactions'
import { applyChatStateAction, applyStoreAction2, applyStoreAction3, applyTreeAction, modifyRenderedElements } from "./inputhandler"
import { StoreAction, StoreF, StoreF2 } from "./storeF"
import { TreeState } from "./tree"
import { LocalStateAction } from 'Lib/tree2'
import { ChatState } from './chatstate'

export const hasKind = <S extends {kind: any}>(kind: S['kind']) => (a: unknown): a is S =>
    isObject(a) && hasOwnProperty(a, 'kind') && a.kind === kind

export function reducer<T1, R>(
    isA: (a: unknown | T1) => a is T1,
    f: (a: T1) => R,
): Reducer<T1, R> {
    return {
        isA, f
    }
}

export interface Reducer<T1, R> {
    f: (a: T1) => R,
    isA: <T2>(a: T1 | T2) => a is T1,
}

export function composeMatchers<T1, T2, R>(
    am: Reducer<T1, R>,
    bm: Reducer<T2, R>,
): Reducer<T1 | T2, R> {
    return ({
        f: (a: T1 | T2) => am.isA(a) ? am.f(a) : bm.f(a),
        isA: <T2>(a: T1 | T2): a is T1 => am.isA(a) || bm.isA(a)
    })
}

export function composeMatchers2<T1, R>(
    m1: Reducer<T1, R>,
): Reducer<T1, R>
export function composeMatchers2<T1, T2, R>(
    m1: Reducer<T1, R>,
    m2: Reducer<T2, R>,
): Reducer<T1 | T2, R>
export function composeMatchers2<T1, T2, T3, R>(
    m1: Reducer<T1, R>,
    m2: Reducer<T2, R>,
    m3: Reducer<T3, R>,
): Reducer<T1 | T2 | T3, R>
export function composeMatchers2<T1, T2, T3, T4, R>(
    m1: Reducer<T1, R>,
    m2: Reducer<T2, R>,
    m3: Reducer<T3, R>,
    m4: Reducer<T4, R>,
): Reducer<T1 | T2 | T3 | T4, R>
export function composeMatchers2<T1, T2, T3, T4, T5, R>(
    m1: Reducer<T1, R>,
    m2: Reducer<T2, R>,
    m3: Reducer<T3, R>,
    m4: Reducer<T4, R>,
    m5: Reducer<T5, R>,
): Reducer<T1 | T2 | T3 | T4 | T5, R>
export function composeMatchers2<R>(...ms: Reducer<any, R>[]) {
    return ({
        f: (a: any) => {
            for (const m of ms) {
                if (m.isA(a)) {
                    return m.f(a)
                }
            }
        },
        isA: (a: any) => {
            for (const m of ms) {
                if (m.isA(a)) {
                    return true
                }
            }
            return false
        },
    })
}

export type ResultFunc<S> = (s: S) => S

export function hasOwnProperty<X extends {}, Y extends PropertyKey>
    (obj: X, prop: Y): obj is X & Record<Y, unknown> {
    return obj.hasOwnProperty(prop)
}

export function isObject(a: unknown): a is object {
    return typeof a === 'object' && a !== null
}

export const localStateMatcher =
    <C extends unknown>() => ({
        f: a => applyTreeAction(a),
        isA: (a: LocalStateAction): a is LocalStateAction =>
            a.kind === 'localstate-action',
    }) as Reducer<LocalStateAction, ResultFunc<C>>


export const storeStateMatcher =
    <K extends keyof R, S, R extends Record<K, StoreF2<any, SH>>,
        SH extends StoreAction<any>>(
            key: K
        ) =>
        reducer(
            (a): a is SH =>
                isObject(a) && hasOwnProperty(a, 'kind')
                && a.kind === 'store-action',
            (a) => applyStoreAction3<S, K, SH>(key, a),
        )



export const chatStateAction = <T>(
    f: <R extends T>(s: R) => R
) => {
    return ({
        kind: 'chatstate-action' as 'chatstate-action',
        f
    })
}

export const update = <T, R extends T>(s: R, u: R): R => ({...s, ...u})

export const chatStateAction2 = <T>(
    ff: <R extends T>(s: R) => R
) => {
    return ({
        kind: 'chatstate-action' as 'chatstate-action',
        f: (s: T) => ({...s, ...ff(s)})
    })
}


export type ChatStateAction<R> = {
    kind: 'chatstate-action',
    f: (s: R) => R
}

export type ChatStateAction2 = {
    kind: 'chatstate-action',
    f: <R>(s: R) => R
}


export const chatStateReducer = <R>() => ({
    f: (a) => applyChatStateAction(a.f),
    isA: (a) => 'kind' in a && a.kind === 'chatstate-action',
}) as Reducer<ChatStateAction<R>, ResultFunc<R>>

export const defaultActionsHandler = <R, H>() => {
    return composeMatchers2(
        localStateMatcher<ChatState<R, H>>(),
        chatStateReducer<ChatState<R, H>>()
    )
}

export const stateReducerToChatActionReducer = <R, H, E>(
    actions: (apply: CA.AppChatAction<R, H, E>) => CA.AppChatAction<R, H, E> = apply => apply
) =>
    function matcherToChatActionMatcher<T1>(
        m: Reducer<T1, ResultFunc<ChatState<R, H>>>,
    ): ChatActionReducer<T1, R, H, E> {
        return ({
            isA: m.isA,
            f: a => actions(CA.mapState<R, H, E>(
                m.f(a)
            ))
        })
    }

// export function storeReducer<
//     K extends keyof R,
//     R extends Record<K, StoreF2<any, any>>, H, E>(
//         key: K
//     ) {
//     const m = stateReducerToChatActionReducer<R, H, E>(a => a)

//     return m(storeStateMatcher<K, R[K]['state'], R,
//         Parameters<R[K]['applyAction']>[0]>(key))
// }


export function storeReducer<
    K extends keyof R,
    R extends Record<K, StoreF2<any, any>>, H, E>(
        key: K,
        actions: (apply: CA.AppChatAction<R, H, E>) => CA.AppChatAction<R, H, E> = apply => apply
    ) {
    const m = stateReducerToChatActionReducer<R, H, E>(
        actions
    )

    return m(storeStateMatcher<K, R[K]['state'], R, Parameters<R[K]['applyAction']>[0]>(key))
}

function localstateAction(index: number[], f: (ts: TreeState) => TreeState): LocalStateAction {
    return { kind: 'localstate-action', index, f }
}

export type ActionToChatActionMapper<R, H, E> = (a: H | H[]) =>
    CA.AppChatAction<R, H, E>[]

export type AppActionMatcher<R, H1, H2, E> = Reducer<H1, CA.AppChatAction<R, H2, E>>
export type ChatActionReducer<T1, R, H, E> = Reducer<T1, CA.AppChatAction<R, H, E>>


export function composeReducers<T1, R, H, E>(
    m1: ChatActionReducer<T1, R, H, E>
): ChatActionReducer<T1, R, H, E>
export function composeReducers<T1, T2, R, H, E>(
    m1: ChatActionReducer<T1, R, H, E>,
    m2: ChatActionReducer<T2, R, H, E>
): ChatActionReducer<T1 | T2, R, H, E>
export function composeReducers<T1, T2, T3, R, H, E>(
    m1: ChatActionReducer<T1, R, H, E>,
    m2: ChatActionReducer<T2, R, H, E>,
    m3: ChatActionReducer<T3, R, H, E>,
): ChatActionReducer<T1 | T2 | T3, R, H, E>
export function composeReducers<T1, T2, T3, T4, R, H, E>(
    m1: ChatActionReducer<T1, R, H, E>,
    m2: ChatActionReducer<T2, R, H, E>,
    m3: ChatActionReducer<T3, R, H, E>,
    m4: ChatActionReducer<T4, R, H, E>,
): ChatActionReducer<T1 | T2 | T3 | T4, R, H, E>
export function composeReducers<T1, T2, T3, T4, T5, R, H, E>(
    m1: ChatActionReducer<T1, R, H, E>,
    m2: ChatActionReducer<T2, R, H, E>,
    m3: ChatActionReducer<T3, R, H, E>,
    m4: ChatActionReducer<T4, R, H, E>,
    m5: ChatActionReducer<T5, R, H, E>,
): ChatActionReducer<T1 | T2 | T3 | T4 | T5, R, H, E>
export function composeReducers<T1, T2, T3, T4, T5, T6, R, H, E>(
    m1: ChatActionReducer<T1, R, H, E>,
    m2: ChatActionReducer<T2, R, H, E>,
    m3: ChatActionReducer<T3, R, H, E>,
    m4: ChatActionReducer<T4, R, H, E>,
    m5: ChatActionReducer<T5, R, H, E>,
    m6: ChatActionReducer<T6, R, H, E>,
): ChatActionReducer<T1 | T2 | T3 | T4 | T5 | T6, R, H, E>
export function composeReducers<R, H, E>(...ms: ChatActionReducer<any, R, H, E>[])
    : ChatActionReducer<any, R, H, E> {
    return ({
        isA: (a): a is any => {
            for (const m of ms) {
                if (m.isA(a))
                    return true
            }
            return false
        },
        f: (a: any) => {
            console.log('composeReducers.f');
            console.log(`a: ${JSON.stringify(a)}`);

            for (const m of ms) {
                if (m.isA(a))
                    return m.f(a)
            }

            console.log('HANDLER NOT FOUND');
            console.log(a);

            return 123 as any
        }
    })
}

export type MakeActionToChatAction<R, H1, H2, E> =
    (m: ChatActionReducer<H1, R, H2, E>) => (a: H1 | H1[]) => CA.AppChatAction<R, H2, E>[]

export type ReducerFunction<R, H1, H2, E> = (a: H1 | H1[]) => CA.AppChatAction<R, H2, E>[]

export function extendReducerFunction<R, H1, H2, H3, E>(
    f: ReducerFunction<R, H1, H2, E>,
    m: ChatActionReducer<H3, R, H2, E>
): ReducerFunction<R, H1 | H3, H2, E> {
    return function aaa(
        a: (H1 | H3) | (H1 | H3)[],
    ): CA.AppChatAction<R, H2, E>[] {

        function go(aa: (H1 | H3) | (H1 | H3)[]): CA.AppChatAction<R, H2, E>[] {
            if (Array.isArray(aa)) {
                return A.flatten(aa.map(go))
            }

            if (m.isA(aa)) {
                return [m.f(aa)]
            }
            return f(aa)
        }

        return go(a)
    }
}

export function reducerToFunction<R, H1, H2, E>(
    m: ChatActionReducer<H1, R, H2, E>
): ReducerFunction<R, H1, H2, E> {
    return function (
        a: H1 | H1[],
    ): CA.AppChatAction<R, H2, E>[] {

        function go(aa: H1 | H1[]): CA.AppChatAction<R, H2, E>[] {
            if (Array.isArray(aa)) {
                return A.flatten(aa.map(go))
            }

            return [m.f(aa)]
        }

        return go(a)
    }
}

export function defaultReducer<R, H, E>()
    : ChatActionReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>>
        | undefined, R, H, E> {
    const m = stateReducerToChatActionReducer<R, H, E>()
    return composeReducers(
        m(localStateMatcher<ChatState<R, H>>()),
        m(chatStateReducer<ChatState<R, H>>()),
        m(reducer(
            (a: undefined | any): a is undefined => a === undefined,
            _ => chatdata => chatdata as ChatState<R, H>
        ))
    )
}

export function defaultActionReducer<R, H, E>() {
    const m = stateReducerToChatActionReducer<R, H, E>()
    const defaultMatcher = composeReducers(
        m(localStateMatcher<ChatState<R, H>>()),
        m(chatStateReducer<ChatState<R, H>>()),
    )

    const defaultActionToChatAction = reducerToFunction(
        defaultMatcher
    )

    return defaultActionToChatAction
}

export type DefaultActions<R, H> = LocalStateAction | ChatStateAction<ChatState<R, H>> | undefined

export function extendDefaultReducer<R, H, E>(
): (a: DefaultActions<R, H>) => CA.AppChatAction<R, H, E>[]
export function extendDefaultReducer<R, H, E, T1>(
    m1: ChatActionReducer<T1, R, H, E>,
): (a: (T1 | DefaultActions<R, H>) | (T1 | DefaultActions<R, H>)[]) => CA.AppChatAction<R, H, E>[]
export function extendDefaultReducer< T1, T2, R, H, E>(
    m1: ChatActionReducer<T1, R, H, E>,
    m2: ChatActionReducer<T2, R, H, E>,
): (a: (T1 | T2 | DefaultActions<R, H>) | (T1 | T2 | DefaultActions<R, H>)[]) => CA.AppChatAction<R, H, E>[]
export function extendDefaultReducer<R, H, E, T1, T2, T3>(
    m1: ChatActionReducer<T1, R, H, E>,
    m2: ChatActionReducer<T2, R, H, E>,
    m3: ChatActionReducer<T3, R, H, E>,
): (a: (T1 | T2 | T3 | DefaultActions<R, H>) | (T1 | T2 | T3 | DefaultActions<R, H>)[]) => CA.AppChatAction<R, H, E>[]

export function extendDefaultReducer<R, H, E, T1, T2, T3, T4>(
    m1: ChatActionReducer<T1, R, H, E>,
    m2: ChatActionReducer<T2, R, H, E>,
    m3: ChatActionReducer<T3, R, H, E>,
    m4: ChatActionReducer<T4, R, H, E>,
): (a: (T1 | T2 | T3 | T4 | DefaultActions<R, H>)
    | (T1 | T2 | T3 | T4 | DefaultActions<R, H>)[]) => CA.AppChatAction<R, H, E>[]

export function extendDefaultReducer<R, H, E>(
    ...ms: ChatActionReducer<any, R, H, E>[]
) {
    if (ms.length == 0) {
        return reducerToFunction(defaultReducer<R, H, E>())
    }
    const c = composeReducers(
        defaultReducer<R, H, E>(),
        ms[0], ms[1], ms[2], ms[3]
    )

    return reducerToFunction(c)
}


export function runBefore<T1, R, H, E>(
    m1: ChatActionReducer<T1, R, H, E>,
    f: CA.AppChatAction<R, H, E>
): ChatActionReducer<T1, R, H, E> {
    return {
        isA: m1.isA,
        f: (a) => {
            return async (ctx) => {
                return await m1.f(a)({ ...ctx, chatdata: await f(ctx) })
            }
        }
    }
}


export function runAfter<T1, R, H, E>(
    m1: ChatActionReducer<T1, R, H, E>,
    f: CA.AppChatAction<R, H, E>
): ChatActionReducer<T1, R, H, E> {
    return {
        isA: m1.isA,
        f: (a) => {
            return async (ctx) => {
                return await f({ ...ctx, chatdata: await m1.f(a)(ctx) })
            }
        }
    }
}
