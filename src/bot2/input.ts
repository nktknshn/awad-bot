import * as O from 'fp-ts/lib/Option';
import { Card } from "../bot/interfaces";
import { createCardFromWord, isEnglishWord, parseCard, parseCardUpdate, parseExample } from "../bot/parsing";
import { parseWordId } from "../bot/utils";
import { InputHandlerElement } from "../lib/elements";
import { InputHandlerData } from "../lib/messages";

export class InputOpt<T> {
    constructor(
        public readonly matcher: (d: O.Option<InputHandlerData>) => O.Option<T>,
        public readonly callback: (res: O.Option<T>, next: () => Promise<boolean | void>) => Promise<any>
    ) { }
}

export function inputGroup(
    matchers: (
        (
            done: () => 'done',
            next: () => 'next',
        ) => (d: O.Option<InputHandlerData>) => O.Option<Promise<any> | 'done' | 'next'>
    )[],
) {
    return new InputHandlerElement(
        async (data, next) => {

            for (const m of matchers) {
                const res = m(() => 'done', () => 'next')(O.of(data))

                if (O.isSome(res))
                    switch(res.value) {
                        case 'next': continue
                        case 'done': return next()
                        case undefined: return
                        default: return res.value
                    }
            }
            return next()
        }
    )
}

export function inputOpt<T>(
    matcher: (d: O.Option<InputHandlerData>) => O.Option<T>,
    callback: (
        res: T,
        next: () => Promise<boolean | void>) => Promise<any>
) {
    return new InputHandlerElement(
        (data, next) => {
            const res = matcher(O.of(data))

            if (O.isSome(res))
                return callback(res.value, next)
            else
                return next()
        }
    )
}


export const messageText = (d: InputHandlerData) => O.fromNullable(d.messageText)

export const createCardFromWordOpt = (text: string): O.Option<Card> => {
    if (!isEnglishWord(text))
        return O.none

    return O.some(createCardFromWord(text))
}

export const parseCardOpt = (text: string) => {
    return O.fromNullable(parseCard(text))
}

export const parseWordIdOpt = (text: string) => {
    return O.fromNullable(parseWordId(text))
}

export const parseExampleOpt = (text: string) => {
    return O.fromNullable(parseExample(text))
}

export const parseCardUpdateOpt = (text: string) => O.fromNullable(parseCardUpdate(text))


