import { WordEntity } from '../database/entity/word'
import { Card, Meaning } from './interfaces'

import { flattenList } from "./utils"

export const [thewordSymbol, descriptionSymbol, exampleSymbol] = ['>', '=', '-']

export function isEnglishWord(input: string) {
    return /^[a-zA-Z]/.test(input)
}

function stripSpaces(line: string) {
    const m = line.match(/^[ \t]+/)

    if (m) {
        return line.slice(m[0].length)
    }

    return line
}

export function parseTags(lines: string[]): string[] {
    const listsOfWords: string[][] = lines.map(line => line.split(' '))
    const words: string[] = flattenList(listsOfWords)
    return words.filter(word => word.startsWith('#'))
}

export function parseTranscription(lines: string[]): string | undefined {
    const matches = lines.filter(line =>
        line.startsWith('/') && line.endsWith('/'))

    if (matches.length > 0)
        return matches[0]
}

export function parseMeanings(lines: string[]): Meaning[] {
    const result: Meaning[] = []

    for (const line of lines) {
        if (line.startsWith(descriptionSymbol)) {
            result.push({
                description: stripSpaces(line.slice(1)),
                examples: []
            })
        }
        else if (line.startsWith(exampleSymbol) && result.length > 0) {
            result[result.length - 1].examples.push(
                stripSpaces(line.slice(1)))
        }
    }

    return result
}

// it could also be written in a more functional way
export const parseTagsLambda = (lines: string[]) =>
    flattenList(lines.map(line => line.split(' ')))
        .filter(word => word.startsWith('#'))


export function createCardFromWord(word: string): Card {
    return {
        word,
        meanings: [],
        tags: []
    }
}

export function parseCard(message: string): Card | undefined {
    const lines = message.split('\n')
    let word = lines[0]

    if (word.startsWith(thewordSymbol))
        word = stripSpaces(word.slice(1))
    else
        return
    // so let's parse tags

    // starting from the second line
    const tags = parseTags(lines.slice(1))

    return {
        word,
        tags,
        transcription: parseTranscription(lines),
        meanings: parseMeanings(lines.slice(1)),
    }
}

export type CardUpdate =  Partial<Pick<Card, 'tags' | 'meanings' | 'word'> >

export function parseExample(message: string): string | undefined {
    if(message.startsWith(exampleSymbol)) {
        return stripSpaces(message.slice(1))
    }
}

export function parseCardUpdate(message: string): CardUpdate | undefined {
    const lines = message.split('\n')
    const tags = parseTags(lines)
    const meanings = parseMeanings(lines)

    if(!tags.length && !meanings.length)
        return

    return {
        tags, meanings
    }
} 

export function makeCardText(w: WordEntity): string {
    return [
        `${thewordSymbol} ${w.theword}`,
        w.tags.join(' '),
        w.transcription ?? '',
        w.meanings.map(({ description, examples }) =>
            [
                `${descriptionSymbol} ${description}`,
                ...examples.map(e => `${exampleSymbol} ${e}`),
                ''
            ].join('\n')
        ).join('\n')
    ].join('\n')
}
