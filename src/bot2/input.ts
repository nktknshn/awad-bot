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

export const caseExample = flow(caseText, O.chain(parseExampleOpt))
export const caseCardUpdate = flow(caseText, O.chain(parseCardUpdateOpt))

export const caseEnglishWord =
    on(caseText, O.chain(createCardFromWordOpt))

export const caseCard =
    on(caseText, O.chain(parseCardOpt))

export const caseWordId =
    on(caseText, O.chain(parseWordIdOpt))

export const caseIfWordId =
    on(caseText, O.chainFirst(parseWordIdOpt))

export const caseWordIdWithSource =
    on(
        caseText,
        O.chain(text =>
            pipe(
                parseWordIdOpt(text),
                O.map(res => [res, text] as const)
            )
        )
    )

