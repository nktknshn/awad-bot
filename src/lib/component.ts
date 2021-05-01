import { GetSetState } from "Libtree2";
import { Subtract } from "./elements";


export type ComponentGenerator<E = any> = Generator<E, void, void>;

type CompConstructor<P, R> = ((props: P) => R);

export type CompConstructorWithState<P, S = never, R = ComponentGenerator> =
    (props: P, getset: GetSetState<S>) => R;

export interface ComponentStateless<P, R = ComponentGenerator> {
    cons: CompConstructor<P, R>;
    props: P;
    kind: 'component';
}

// export interface ComponentWithState<P, S = never, R = ComponentGenerator> {
//     cons: CompConstructorWithState<P, S, R>;
//     props: P;
//     kind: 'component-with-state';
// }

export type ComponentWithState<P, S = never, R = ComponentGenerator> = ComponentConnected<P, S, {}, {}, R>

export interface ComponentConnected<P extends M, S, M, RootState, R = ComponentGenerator> {
    cons: CompConstructorWithState<P, S, R>;
    mapper: (state: RootState) => M;
    props: Subtract<P, M>;
    kind: 'component-with-state-connected';
    id: string;
}

export type ComponentElement =
    // ComponentStateless<any> |
    // ComponentWithState<any, any> |
    // ComponentWithState<any, any, any> |
    ComponentConnected<any, any, any, any> |
    ComponentConnected<any, any, any, any, any>;

export function Component<P, S, R extends ComponentGenerator>(cons: CompConstructorWithState<P, S, R>) {
    return function (props: P): ComponentConnected<P, S, {}, {}, R> {
        return {
            cons,
            mapper: (a) => ({}),
            props,
            kind: 'component-with-state-connected',
            id: cons.toString()
        };
    };
}

export function ConnectedComp<P extends M, S, M, State, R extends ComponentGenerator>(
    cons: CompConstructorWithState<P, S, R>,
    mapper: (state: State) => M
): (props: Subtract<P, M>) => ComponentConnected<P, S, M, State, R> {
    return function (props: Subtract<P, M>): ComponentConnected<P, S, M, State, R> {
        return {
            id: cons.toString(),
            cons,
            props,
            mapper,
            kind: 'component-with-state-connected'
        };
    };
}

export function connected1<P extends M, S, M, State, R extends ComponentGenerator>(
    mapper: (state: State) => M,
    cons: CompConstructorWithState<P, S, R>
) {
    return ConnectedComp(cons, mapper);
}

export function connected2<P extends M, S, M, State, PP, R extends ComponentGenerator>(
    mapper: (state: State) => M,
    cons: (reqs: P) => (props: PP, getset: GetSetState<S>) => R
): (props: PP) => ComponentConnected<P & PP, S, M, State, R> {
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

export function connected<P extends M, S, M, State, PP, R extends ComponentGenerator>(
    mapper: (state: State) => M,
    cons: (reqs: P, props: PP, getset: GetSetState<S>) => R
): (props: PP) => ComponentConnected<P & PP, S, M, State, R> {
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
