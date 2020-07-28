import { Card } from './interfaces'

// using the {} I import certain things from utils module
import { flattenList } from "./utils"

// I could do it like this. importing the module as a namespace
import * as utils from './utils'


/* 

the input can be
asd asd ads
#tag1 #tag2
#tag3
asd
sad

so let's make it first
asd 
asd 
ads
#tag1
#tag2
#tag3
asd
sad

and then filter words that are starting with the hash
*/
export function parseTags(lines: string[]) {
    const listsOfWords: string[][] = lines.map(line => line.split(' '))

    // now words is a list like
    /* 
       [ [asd, asd, ads],
        [#tag1, #tag2],
        [#tag3],
        [asd],
        [sad],]
    */

    // so we need to flatten it to a liner list. We need a function string[][] => string[]
    const words = flattenList(listsOfWords)

    // now filter the tags
    return words.filter(word => word.startsWith('#'))

}

// it could also be written in a more functional way

export const parseTagsLambda = (lines: string[]) =>
    flattenList(lines.map(line => line.split(' ')))
        .filter(word => word.startsWith('#'))


export function parseCard(message: string): Card | undefined {
    const lines = message.split('\n')
    const word = lines[0]

    // so let's parse tags

    // starting from the second line
    const tags = parseTags(lines.slice(1))

    return {
        word,
        tags,
        meanings: [],
    }
}