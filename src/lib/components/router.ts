import { isSome, none, Option, some } from "fp-ts/lib/Option";
import { Component, ComponentConnected, ComponentGenerator, ComponentWithState, connected } from "../component";

interface RouteMatcher<PP, P extends M, S, M, RS, R> {
    (path: PP): Option<ComponentConnected<P, S, M, RS, R>>;
}
export function routeMatcher<PP, P extends M, S, M, RS, E>(
    f: (props: PP) => boolean,
    c: (props: PP) => ComponentConnected<P, S, M, RS, E>) {
    return (props: PP) => f(props) ? some(c(props)) : none;
}

export function Router<P,
    P1 extends M1, S1, M1, RS1, R1,
    P2 extends M2, S2, M2, RS2, R2,
    >(
        m1: RouteMatcher<P, P1, S1, M1, RS1, R1>,
        unmatched: ComponentConnected<P2, S2, M2, RS2, R2>
    )
    : (props: P) => ComponentWithState<P, unknown,
            ComponentConnected<P1, S1, M1, RS1, R1>
            | ComponentConnected<P2, S2, M2, RS2, R2>
           >;

export function Router<P,
    P1 extends M1, S1, M1, RS1, R1,
    P2 extends M2, S2, M2, RS2, R2,
    P3 extends M3, S3, M3, RS3, R3,
    >(
        m1: RouteMatcher<P, P1, S1, M1, RS1, R1>,
        m2: RouteMatcher<P, P2, S2, M2, RS2, R2>,
        unmatched: ComponentConnected<P3, S3, M3, RS3, R3>
    ): (props: P) => ComponentWithState<P, unknown,
        
            ComponentConnected<P1, S1, M1, RS1, R1>
            | ComponentConnected<P2, S2, M2, RS2, R2>
            | ComponentConnected<P3, S3, M3, RS3, R3>
           >;

export function Router<P,
    P1 extends M1, S1, M1, RS1, R1,
    P2 extends M2, S2, M2, RS2, R2,
    P3 extends M3, S3, M3, RS3, R3,
    P4 extends M4, S4, M4, RS4, R4,
    >(
        m1: RouteMatcher<P, P1, S1, M1, RS1, R1>,
        m2: RouteMatcher<P, P2, S2, M2, RS2, R2>,
        m3: RouteMatcher<P, P3, S3, M3, RS3, R3>,
        unmatched: ComponentConnected<P4, S4, M4, RS4, R4>
    ): (props: P) => ComponentWithState<P, unknown,
        
            ComponentConnected<P1, S1, M1, RS1, R1>
            | ComponentConnected<P2, S2, M2, RS2, R2>
            | ComponentConnected<P3, S3, M3, RS3, R3>
            | ComponentConnected<P4, S4, M4, RS4, R4>
            >;

export function Router<P,
    P1 extends M1, S1, M1, RS1, R1,
    P2 extends M2, S2, M2, RS2, R2,
    P3 extends M3, S3, M3, RS3, R3,
    P4 extends M4, S4, M4, RS4, R4,
    P5 extends M5, S5, M5, RS5, R5,
    >(
        m1: RouteMatcher<P, P1, S1, M1, RS1, R1>,
        m2: RouteMatcher<P, P2, S2, M2, RS2, R2>,
        m3: RouteMatcher<P, P3, S3, M3, RS3, R3>,
        m4: RouteMatcher<P, P4, S4, M4, RS4, R4>,
        unmatched: ComponentConnected<P5, S5, M5, RS5, R5>
    ): (props: P) => ComponentWithState<P, unknown,
        
            ComponentConnected<P1, S1, M1, RS1, R1>
            | ComponentConnected<P2, S2, M2, RS2, R2>
            | ComponentConnected<P3, S3, M3, RS3, R3>
            | ComponentConnected<P4, S4, M4, RS4, R4>
            | ComponentConnected<P5, S5, M5, RS5, R5>
           >;

export function Router(...matchers: any[]) {
    return connected(
        (_) => ({}),
        function* (
            props: any
        ) {
            for (const m of matchers.slice(0, matchers.length - 1)) {
                const opt = m(props);

                if (isSome(opt)) {
                    yield opt.value;
                    return
                }
            }

            yield matchers[matchers.length - 1]
        }
    );
}
