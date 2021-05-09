import { ChatState, getUserMessages } from "./application";
import { ComponentConnected, isComponent } from "./component";

export const withUserMessages = <R, H>(c: ChatState<R, H>) => ({ userMessages: getUserMessages(c) });


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


export function mapContext<
    K extends keyof any, P extends M, S, M, State, E, E2
>(
    key: K,
    comp: ComponentConnected<P, S, M, State, E, E2>
): ComponentConnected<P, S, M, Record<K, State>, E, WithContext<K, E2>> {
    return {
        ...comp,
        mapper: (ctx: Record<K, State>) => comp.mapper(ctx[key]),
        mapChildren: ((e: E) => isComponent(e) ? mapContext(key, e) : e) as any
    }
}
