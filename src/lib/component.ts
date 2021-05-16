import { GetSetState } from "Lib/tree2";
import { Subtract } from "./elements";
import { hasOwnProperty, isObject } from "./reducer";


export type ComponentGenerator<E> = Generator<E, void, void>;

type CompConstructor<P, R> = ((props: P) => R);

export type CompConstructorWithState<P, S, E> =
    (props: P, getset: GetSetState<S>) => ComponentGenerator<E>;

export interface ComponentStateless<P, R extends ComponentGenerator<E>, E> {
    cons: CompConstructor<P, R>;
    props: P;
    kind: 'component';
}

export type ComponentWithState<P, S, E> = ComponentConnected<P, S, {}, {}, E>

export interface ComponentConnected<P extends M, S, M, RootState, E, E2 = E> {
    cons: CompConstructorWithState<P, S, E>;
    mapper: (state: RootState) => M;
    props: Subtract<P, M>;
    kind: 'component-with-state-connected';
    id: string;
    mapChildren?: (comp: E) => E2
}

export type ComponentElement<E = any> =
    // ComponentConnected<any, any, any, any, any> |
    ComponentConnected<any, any, any, any, E>;

export function Component<P, S, E>(cons: CompConstructorWithState<P, S, E>) {
    return function (props: P): ComponentConnected<P, S, {}, {}, E> {
        return {
            cons,
            mapper: (_) => ({}),
            props,
            kind: 'component-with-state-connected',
            id: cons.toString()
        };
    };
}

export function isComponent<E>(e: unknown): e is ComponentElement<E> {
    return isObject(e) && hasOwnProperty(e, 'kind') && e.kind === 'component-with-state-connected'
}

export function ConnectedComp<P extends M, S, M, State, E>(
    cons: CompConstructorWithState<P, S, E>,
    mapper: (state: State) => M
): (props: Subtract<P, M>) => ComponentConnected<P, S, M, State, E> {
    return function (props: Subtract<P, M>): ComponentConnected<P, S, M, State, E> {
        return {
            id: cons.toString(),
            cons,
            props,
            mapper,
            kind: 'component-with-state-connected'
        };
    };
}

export function connected0<P, S, E>(
    cons: CompConstructorWithState<P, S, E>
) {
    return (props: P) => ConnectedComp(cons, _ => ({}))(props);
}


export function connected1<P extends M, S, M, State, E>(
    mapper: (state: State) => M,
    cons: CompConstructorWithState<P, S, E>
) {
    return ConnectedComp(cons, mapper);
}

export function connected2<P extends M, S, M, State, PP, E>(
    mapper: (state: State) => M,
    cons: (reqs: P) => (props: PP, getset: GetSetState<S>) => ComponentGenerator<E>
): (props: PP) => ComponentConnected<P & PP, S, M, State, E> {
    return (props: PP) => (
        {
            cons: (reqs: P, getset: GetSetState<S>) => cons(reqs)(props, getset),
            props: (props as unknown) as Subtract<P & PP, M>,
            mapper,
            kind: 'component-with-state-connected',
            id: cons.toString()
        }
    );
}

export type LazyType<T> = T


export function connected<P extends M, S, M, State, PP, E>(
    mapper: (state: State) => M,
    cons: (reqs: Readonly<P>, props: PP, getset: GetSetState<S>) => ComponentGenerator<E>
): (props: PP) => ComponentConnected<P & PP, S, M, State, E> {
    return (props: PP) => (
        {
            cons: (reqs: P, getset: GetSetState<S>) => cons(reqs, props, getset),
            props: (props as unknown) as Subtract<P & PP, M>,
            mapper,
            kind: 'component-with-state-connected',
            id: cons.toString()
        }
    );
}

export type ConnectedM<P = {}, PP = unknown, S = {}> = { reqs?: Readonly<P>, props?: PP, getset: GetSetState<S> }

export function connectedR<P extends M, S, M, State, PP, E>(
    mapper: (state: State) => M,
    cons: (rec: { reqs?: Readonly<P>, props?: PP, getset: GetSetState<S> }) => ComponentGenerator<E>
): (props: PP) => ComponentConnected<P & PP, S, M, State, E> {
    return (props: PP) => (
        {
            cons: (reqs: P, getset: GetSetState<S>) => cons({ reqs, props, getset }),
            props: (props as unknown) as Subtract<P & PP, M>,
            mapper,
            kind: 'component-with-state-connected',
            id: cons.toString()
        }
    );
}


export function connectedMap<P extends M, S, M, State, PP, E, E2 = E>(
    mapper: (state: State) => M,
    cons: (reqs: Readonly<P>, props: PP, getset: GetSetState<S>) => ComponentGenerator<E>,
    mapChildren: (el: E) => E2
): (props: PP) => ComponentConnected<P & PP, S, M, State, E, E2> {
    return (props: PP) => (
        {
            cons: (reqs: P, getset: GetSetState<S>) => cons(reqs, props, getset),
            mapChildren,
            props: (props as unknown) as Subtract<P & PP, M>,
            mapper,
            kind: 'component-with-state-connected',
            id: cons.toString()
        }
    );
}

// export function mapped<P extends M, S, M, State, E, E2>(
//     comp: ComponentConnected<P, S, M, State, E>,
//     f: (el: E) => E2
// ): ComponentConnected<P, S, M, State, E2> {
//     return (
//         {
//             ...comp,
//             cons: (function* (reqs: any, getset: any): ComponentGenerator<any> {
//                 for (const el of comp.cons(reqs, getset)) {
//                     yield f(el)
//                 }
//             } as any)
//         }
//     );
// }

// export function mappedContext<P extends M, S, M, State, E, State2>(
//     comp: ComponentConnected<P, S, M, State, E>,
//     f: (el: State) => State2
// ): ComponentConnected<P, S, M, State2, E> {
//     return(
//         {
//             ...comp,
//             cons: (function *(reqs: any, getset: any){
//                 for (const el of comp.cons(reqs, getset)) {
//                     yield f(el)
//                 }
//             } as any)
//         }
//     );
// }
