import * as O from 'fp-ts/lib/Option';
import { flow, identity } from "fp-ts/lib/function";
import { pipe } from 'fp-ts/lib/pipeable';
import { Do } from 'fp-ts-contrib/lib/Do';

import { InputHandlerElement } from "./elements";
import { InputHandlerData } from "./messages";

import { TelegrafContext } from 'telegraf/typings/context';

type Matcher2Ret<R> = O.Option<R | 'done' | 'next'>;

export type Matcher2<R> = (d: O.Option<InputHandlerData>) => Matcher2Ret<R>

export class InputOpt<T> {
    constructor(
        public readonly matcher: (d: O.Option<InputHandlerData>) => O.Option<T>,
        public readonly callback: (res: O.Option<T>, next: () => Promise<boolean | void>) => Promise<any>
    ) { }
}

export const on = flow;
export const otherwise = O.chain((d: InputHandlerData) =>
    Do(O.option)
        .bind('messageId', messageId(d))
        .bind('data', O.some(d))
        .return(identity))


export const nextHandler = (): 'done' => 'done';
export const nextMatcher = (): 'next' => 'next';
export const stop = (): undefined => undefined;

export function inputHandler<R extends ReadonlyArray<Matcher2<any>>>(
    matchers: R
) {
    return new InputHandlerElement<R | undefined>(
        (data, next) => {

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

export function inputOpt<T, R>(
    matcher: (d: O.Option<InputHandlerData>) => O.Option<T>,
    callback: (
        res: T,
        next: () => (R | undefined)) => R | undefined
) {
    return new InputHandlerElement<R | undefined>(
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
export const actionMapped = <A, B>(f: (a: A) => B) => O.map

export const messageText = (d: InputHandlerData) =>
    pipe(O.fromNullable(d.messageText), O.filter(t => !!t.length));

export const messageId = (d: InputHandlerData) =>
    O.fromNullable(d.ctx.message?.message_id)

export const casePhoto = O.chain((d: InputHandlerData) =>
    Do(O.option)
        .bind('photo', O.fromNullable(d.photo))
        .bind('messageId', messageId(d))
        .return(identity))
//  O.chain((d: InputHandlerData) => O.fromNullable(d.photo))

export const caseText = O.chain((d: InputHandlerData) =>
    Do(O.option)
        .bind('messageText', messageText(d))
        .bind('messageId', messageId(d))
        .return(identity))

// O.chain(messageText);
export const nextHandlerAction = action(nextHandler)
// export const ifTrue = (pred: () => boolean) => <T>(m: O.Option<T>) => pred() ? m : O.none
export const ifTrue = O.filter
export const caseTextEqual = (text: string) => on(caseText, ifTrue(({ messageText }) => messageText == text))
