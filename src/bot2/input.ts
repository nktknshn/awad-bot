import * as O from 'fp-ts/lib/Option';
import { Card } from "../bot/interfaces";
import { createCardFromWord, isEnglishWord, parseCard, parseCardUpdate, parseExample } from "../bot/parsing";
import { parseWordId } from "../bot/utils";
import { flow, pipe } from "fp-ts/lib/function";
import { caseText, messageText, on } from '../lib/input';

export const createCardFromWordOpt = (text: string): O.Option<Card> => {
    if (!isEnglishWord(text))
        return O.none

    return O.some(createCardFromWord(text))
}

export const parseCardOpt = O.fromNullableK(parseCard)

export const parseWordIdOpt = O.fromNullableK(parseWordId)

export const parseExampleOpt = (text: string) => O.fromNullable(parseExample(text))
export const parseCardUpdateOpt = (text: string) => O.fromNullable(parseCardUpdate(text))

export const caseExample = flow(caseText,
    O.chain(a => pipe(a,
        a => parseExampleOpt(a.messageText),
        O.map(example => ({
            ...a, example
        }))))
)

export const caseCardUpdate = flow(caseText,
    O.chain(a => pipe(a,
        a => parseCardUpdateOpt(a.messageText),
        O.map(example => ({
            ...a, ...example
        }))))
)

export const caseEnglishWord =
    flow(caseText,
        O.chain(a => pipe(a,
            a => createCardFromWordOpt(a.messageText),
            O.map(example => ({
                ...a, example
            }))))
    )

export const caseCard =
    flow(caseText,
        O.chain(a => pipe(a,
            a => parseCardOpt(a.messageText),
            O.map(card => ({
                ...a, card
            }))))
    )

export const caseWordId =
flow(caseText,
    O.chain(a => pipe(a,
        a => parseWordIdOpt(a.messageText),
        O.map(example => ({
            ...a, example
        }))))
)

export const caseIfWordId =
flow(caseText,
    O.chain(a => pipe(a,
        a => parseWordIdOpt(a.messageText),
        O.map(example => ({
            ...a, example
        })))))

export const caseWordIdWithSource =
    on(
        caseText,
        O.map(({ messageText }) => messageText),
        O.chain(text =>
            pipe(
                parseWordIdOpt(text),
                O.map(res => [res, text] as const)
            )
        )
    )

