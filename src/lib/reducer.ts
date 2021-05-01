import * as A from 'fp-ts/lib/Array'
import { Flush } from '../bot3/util'
import * as CA from './chatactions'
import { ChatState } from "./application"
import { applyChatStateAction, applyStoreAction2, applyTreeAction, modifyRenderedElements } from "./inputhandler"
import { StoreAction, StoreF } from "./storeF"
import { TreeState } from "./tree"
import { LocalStateAction } from 'Libtree2'

export function reducer<T1, R>(
    isA: <T2>(a: T1 | T2) => a is T1,
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

export const localStateMatcher =
    <S>() => ({
        f: applyTreeAction,
        isA: (a): a is LocalStateAction => 'kind' in a && a.kind === 'localstate-action',
    }) as Reducer<LocalStateAction, ResultFunc<S>>


export const storeStateMatcher =
    <S, R extends { store: StoreF<S> }, H>() =>
        ({
            f: (a) => applyStoreAction2<S>(a),
            isA: (a): a is StoreAction<S> => 'kind' in a && a.kind === 'store-action',
        }) as Reducer<StoreAction<S>, ResultFunc<ChatState<R, H>>>


export type ChatStateAction<R> = {
    kind: 'chatstate-action',
    f: (s: R) => R
}

export const chatStateMatcher = <R>() => ({
    f: (a) => applyChatStateAction(a.f),
    isA: (a) => 'kind' in a && a.kind === 'chatstate-action',
}) as Reducer<ChatStateAction<R>, ResultFunc<R>>

export const defaultActionsHandler = <R, H>() => {
    return composeMatchers2(
        localStateMatcher<ChatState<R, H>>(),
        chatStateMatcher<ChatState<R, H>>()
    )
}

export function storeReducer<R extends { store: StoreF<any> }, H, E>() {
    const m = matcherToChatActionMatcher<R, H, E>()
    return m(storeStateMatcher<R['store']['state'], R, H>())
}

function localstateAction(index: number[], f: (ts: TreeState) => TreeState): LocalStateAction {
    return { kind: 'localstate-action', index, f }
}

export type ActionToChatActionMapper<R, H, E> = (a: H | H[]) => CA.AppChatAction<R, H, E>[]

export type AppActionMatcher<R, H1, H2, E> = Reducer<H1, CA.AppChatAction<R, H2, E>>
export type ChatActionReducer<T1, R, H, E> = Reducer<T1, CA.AppChatAction<R, H, E>>


type MatcherToChatActionMatcher<R, H, E> = () =>
    <T1>(m: Reducer<T1, ResultFunc<ChatState<R, H>>>) =>
        ChatActionReducer<T1, R, H, E>

export const matcherToChatActionMatcher = <R, H, E>() =>
    function matcherToChatActionMatcher<T1>(
        m: Reducer<T1, ResultFunc<ChatState<R, H>>>,
    ): ChatActionReducer<T1, R, H, E> {
        return ({
            isA: m.isA,
            f: a => CA.mapState<R, H, E>(
                m.f(a)
            )
        })
    }

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
            console.log(a);
            console.log(ms);

            for (const m of ms) {
                if (m.isA(a))
                    return m.f(a)
            }

            return 123 as any
        }
    })
}

export type MakeActionToChatAction<R, H1, H2, E> =
    (m: ChatActionReducer<H1, R, H2, E>) => (a: H1 | H1[]) => CA.AppChatAction<R, H2, E>[]

export function reducerToFunction<R, H1, H2, E>(
    m: ChatActionReducer<H1, R, H2, E>
) {
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

export function defaultReducer<R, H, E>() {
    const m = matcherToChatActionMatcher<R, H, E>()
    return composeReducers(
        m(localStateMatcher<ChatState<R, H>>()),
        m(chatStateMatcher<ChatState<R, H>>()),
    )
}

export function defaultActionReducer<R, H, E>() {
    const m = matcherToChatActionMatcher<R, H, E>()
    const defaultMatcher = composeReducers(
        m(localStateMatcher<ChatState<R, H>>()),
        m(chatStateMatcher<ChatState<R, H>>()),
    )

    const defaultActionToChatAction = reducerToFunction(
        defaultMatcher
    )

    return defaultActionToChatAction
}

type DefaultActions<R, H> = LocalStateAction | ChatStateAction<ChatState<R, H>>

export function extendDefaultReducer<R, H, E>(
): () => CA.AppChatAction<R, H, E>[]
export function extendDefaultReducer<R, H, E, T1>(
    m1: ChatActionReducer<T1, R, H, E>,
): (a: (T1 | DefaultActions<R, H>) | (T1 | DefaultActions<R, H>)[]) => CA.AppChatAction<R, H, E>[]
export function extendDefaultReducer<R, H, E, T1, T2>(
    m1: ChatActionReducer<T1, R, H, E>,
    m2: ChatActionReducer<T2, R, H, E>,
): (a: (T1 | T2 | DefaultActions<R, H>) | (T1 | T2 | DefaultActions<R, H>)[]) => CA.AppChatAction<R, H, E>[]
export function extendDefaultReducer<R, H, E>(
    m1?: any, m2?: any
) {
    if(!m1 && !m2) {
        return reducerToFunction(defaultReducer<R, H, E>())
    }
    const c = m2 ? composeReducers(
        defaultReducer<R, H, E>(),
        m1, m2
    ) : composeReducers(
        defaultReducer<R, H, E>(),
        m1
    )


    return reducerToFunction(c)
}

export const isFlush = (a: Flush | any): a is Flush => a.kind === 'flush'

export function flushReducer<R, H, E>(
    action: CA.AppChatAction<R, H, E>
): ChatActionReducer<Flush, R, H, E> {
    return {
        isA: isFlush,
        f: () => action
    }
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
