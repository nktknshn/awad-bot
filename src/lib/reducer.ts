import * as A from 'fp-ts/lib/Array'
import { pipe } from 'fp-ts/lib/pipeable'
import { Flush } from '../bot3/util'
import * as CA from './chatactions'
import { ChatState } from "./chathandler"
import { LocalStateAction } from "./elements"
import { applyChatStateAction, applyStoreAction2, applyTreeAction, modifyRenderedElements } from "./inputhandler"
import { StoreAction, StoreF } from "./storeF"
import { TreeState } from "./tree"


export interface ActionMatcher<T1, R> {
    f: (a: T1) => R,
    isA: <T2>(a: T1 | T2) => a is T1,
}

export function composeMatchers<T1, T2, R>(
    am: ActionMatcher<T1, R>,
    bm: ActionMatcher<T2, R>,
): ActionMatcher<T1 | T2, R> {
    return ({
        f: (a: T1 | T2) => am.isA(a) ? am.f(a) : bm.f(a),
        isA: <T2>(a: T1 | T2): a is T1 => am.isA(a) || bm.isA(a)
    })
}

export function composeMatchers2<T1, R>(
    m1: ActionMatcher<T1, R>,
): ActionMatcher<T1, R>
export function composeMatchers2<T1, T2, R>(
    m1: ActionMatcher<T1, R>,
    m2: ActionMatcher<T2, R>,
): ActionMatcher<T1 | T2, R>
export function composeMatchers2<T1, T2, T3, R>(
    m1: ActionMatcher<T1, R>,
    m2: ActionMatcher<T2, R>,
    m3: ActionMatcher<T3, R>,
): ActionMatcher<T1 | T2 | T3, R>
export function composeMatchers2<T1, T2, T3, T4, R>(
    m1: ActionMatcher<T1, R>,
    m2: ActionMatcher<T2, R>,
    m3: ActionMatcher<T3, R>,
    m4: ActionMatcher<T4, R>,
): ActionMatcher<T1 | T2 | T3 | T4, R>
export function composeMatchers2<T1, T2, T3, T4, T5, R>(
    m1: ActionMatcher<T1, R>,
    m2: ActionMatcher<T2, R>,
    m3: ActionMatcher<T3, R>,
    m4: ActionMatcher<T4, R>,
    m5: ActionMatcher<T5, R>,
): ActionMatcher<T1 | T2 | T3 | T4 | T5, R>
export function composeMatchers2<R>(...ms: ActionMatcher<any, R>[]) {
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
    }) as ActionMatcher<LocalStateAction, ResultFunc<S>>


export const storeStateMatcher =
    <S, R extends { store: StoreF<S> }, H>() =>
        ({
            f: (a) => applyStoreAction2<S>(a),
            isA: (a): a is StoreAction<S> => 'kind' in a && a.kind === 'store-action',
        }) as ActionMatcher<StoreAction<S>, ResultFunc<ChatState<R, H>>>


type ChatStateAction<R> = {
    kind: 'chatstate-action',
    f: (s: R) => R
}

export const chatStateMatcher = <R>() => ({
    f: (a) => applyChatStateAction(a.f),
    isA: (a) => 'kind' in a && a.kind === 'chatstate-action',
}) as ActionMatcher<ChatStateAction<R>, ResultFunc<R>>


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

export type AppActionMatcher<R, H1, H2, E> = ActionMatcher<H1, CA.AppChatAction<R, H2, E>>
export type ChatActionMatcher<T1, R, H, E> = ActionMatcher<T1, CA.AppChatAction<R, H, E>>


type MatcherToChatActionMatcher<R, H, E> = () =>
    <T1>(m: ActionMatcher<T1, ResultFunc<ChatState<R, H>>>) =>
        ChatActionMatcher<T1, R, H, E>

export const matcherToChatActionMatcher = <R, H, E>() =>
    function matcherToChatActionMatcher<T1>(
        m: ActionMatcher<T1, ResultFunc<ChatState<R, H>>>,
    ): ChatActionMatcher<T1, R, H, E> {
        return ({
            isA: m.isA,
            f: a => CA.pipeState<R, H, E>(
                m.f(a)
            )
        })
    }

export function composeChatActionMatchers<T1, R, H, E>(
    m1: ChatActionMatcher<T1, R, H, E>
): ChatActionMatcher<T1, R, H, E>
export function composeChatActionMatchers<T1, T2, R, H, E>(
    m1: ChatActionMatcher<T1, R, H, E>,
    m2: ChatActionMatcher<T2, R, H, E>
): ChatActionMatcher<T1 | T2, R, H, E>
export function composeChatActionMatchers<T1, T2, T3, R, H, E>(
    m1: ChatActionMatcher<T1, R, H, E>,
    m2: ChatActionMatcher<T2, R, H, E>,
    m3: ChatActionMatcher<T3, R, H, E>,
): ChatActionMatcher<T1 | T2 | T3, R, H, E>
export function composeChatActionMatchers<T1, T2, T3, T4, R, H, E>(
    m1: ChatActionMatcher<T1, R, H, E>,
    m2: ChatActionMatcher<T2, R, H, E>,
    m3: ChatActionMatcher<T3, R, H, E>,
    m4: ChatActionMatcher<T4, R, H, E>,
): ChatActionMatcher<T1 | T2 | T3 | T4, R, H, E>
export function composeChatActionMatchers<T1, T2, T3, T4, T5, R, H, E>(
    m1: ChatActionMatcher<T1, R, H, E>,
    m2: ChatActionMatcher<T2, R, H, E>,
    m3: ChatActionMatcher<T3, R, H, E>,
    m4: ChatActionMatcher<T4, R, H, E>,
    m5: ChatActionMatcher<T5, R, H, E>,
): ChatActionMatcher<T1 | T2 | T3 | T4 | T5, R, H, E>
export function composeChatActionMatchers<R, H, E>(...ms: ChatActionMatcher<any, R, H, E>[])
    : ChatActionMatcher<any, R, H, E> {
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
    (m: ChatActionMatcher<H1, R, H2, E>) => (a: H1 | H1[]) => CA.AppChatAction<R, H2, E>[]

export function makeActionToChatAction<R, H1, H2, E>(
    m: ChatActionMatcher<H1, R, H2, E>
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

export function defaultMatcher<R, H, E>() {
    const m = matcherToChatActionMatcher<R, H, E>()
    return composeChatActionMatchers(
        m(localStateMatcher<ChatState<R, H>>()),
        m(chatStateMatcher<ChatState<R, H>>()),
    )
}

export function defaultActionToChatAction<R, H, E>() {
    const m = matcherToChatActionMatcher<R, H, E>()
    const defaultMatcher = composeChatActionMatchers(
        m(localStateMatcher<ChatState<R, H>>()),
        m(chatStateMatcher<ChatState<R, H>>()),
    )

    const defaultActionToChatAction = makeActionToChatAction(
        defaultMatcher
    )

    return defaultActionToChatAction
}

type DefaultActions<R, H, E> = LocalStateAction | ChatStateAction<ChatState<R, H>>

export function extendDefaultReducer<R, H, E, T1>(
    m1: ChatActionMatcher<T1, R, H, E>,
): (a: (T1 | DefaultActions<R, H, E>) | (T1 | DefaultActions<R, H, E>)[]) => CA.AppChatAction<R, H, E>[]
export function extendDefaultReducer<R, H, E, T1, T2>(
    m1: ChatActionMatcher<T1, R, H, E>,
    m2: ChatActionMatcher<T2, R, H, E>,
): (a: (T1 | T2 | DefaultActions<R, H, E>) | (T1 | T2 | DefaultActions<R, H, E>)[]) => CA.AppChatAction<R, H, E>[]
export function extendDefaultReducer<R, H, E>(
    m1: any, m2?: any
) {
    const c = m2 ? composeChatActionMatchers(
        defaultMatcher<R, H, E>(),
        m1, m2
    ) : composeChatActionMatchers(
        defaultMatcher<R, H, E>(),
        m1
    )


    return makeActionToChatAction(c)
}

export const isFlush = (a: Flush | any): a is Flush => a.kind === 'flush'

export function flushMatcher<R, H, E>(): ChatActionMatcher<Flush, R, H, E> {
    return {
        isA: isFlush,
        f: () => {
            return async ({ chatdata, tctx }) => {
                // for (const r of chatdata.renderedElements) {
                //     for (const id of r.outputIds()) {
                //         await tracker.untrackRenderedMessage(tctx.chat?.id!, id)
                //     }
                // }

                // return pipe(
                //     chatdata,
                //     modifyRenderedElements(_ => [])
                // )
                return chatdata
            }
        }
    }
}

export function runBefore<T1, R, H, E>(
    m1: ChatActionMatcher<T1, R, H, E>,
    f: CA.ChatAction<R, H, ChatState<R, H>, E>,
): ChatActionMatcher<T1, R, H, E> {
    return {
        isA: m1.isA,
        f: (a) => {
            return async (ctx) => {
                return await m1.f(a)({ ...ctx, chatdata: await f(ctx) })
            }
        }
    }
}
