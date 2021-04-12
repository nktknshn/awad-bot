import * as O from 'fp-ts/lib/Option';
import { InputHandlerElement } from "./elements";
import { InputHandlerData } from "./messages";
import { flow, identity } from "fp-ts/lib/function";


export class InputOpt<T> {
    constructor(
        public readonly matcher: (d: O.Option<InputHandlerData>) => O.Option<T>,
        public readonly callback: (res: O.Option<T>, next: () => Promise<boolean | void>) => Promise<any>
    ) { }
}

export const on = flow;
export const otherwise = flow(identity);


export type Matcher = (
    done: () => 'done',
    next: () => 'next'
) => (d: O.Option<InputHandlerData>) => O.Option<Promise<any> | 'done' | 'next'>;

export function inputGroup(
    matchers: Matcher[]
) {
    return new InputHandlerElement(
        async (data, next) => {

            for (const m of matchers) {
                const res = m(() => 'done', () => 'next')(O.of(data));

                if (O.isSome(res))
                    switch (res.value) {
                        case 'next': continue;
                        case 'done': return next();
                        case undefined: return;
                        default: return res.value;
                    }
            }
            return next();
        }
    );
}


export type Matcher2 = (d: O.Option<InputHandlerData>) => O.Option<Promise<any> | 'done' | 'next'>;

export const done = (): 'done' => 'done';
export const next = (): 'next' => 'next';

export function inputGroup2(
    ...matchers: Matcher2[]
) {
    return new InputHandlerElement(
        async (data, next) => {

            for (const m of matchers) {
                const res = m(O.of(data));

                if (O.isSome(res))
                    switch (res.value) {
                        case 'next': continue;
                        case 'done': return next();
                        case undefined: return;
                        default: return res.value;
                    }
            }
            return next();
        }
    );
}

export function inputOpt<T>(
    matcher: (d: O.Option<InputHandlerData>) => O.Option<T>,
    callback: (
        res: T,
        next: () => Promise<boolean | void>) => Promise<any>
) {
    return new InputHandlerElement(
        (data, next) => {
            const res = matcher(O.of(data));

            if (O.isSome(res))
                return callback(res.value, next);

            else
                return next();
        }
    );
}
export const action = O.map;

export const messageText = (d: InputHandlerData) => O.fromNullable(d.messageText);
export const caseText = O.chain(messageText);
export const nextHandler = action(done)
