import { range } from "../bot/utils";
import { WordEntity } from "../database/entity/word";
import { zip } from "../lib/util";
import { WordsList } from "./app";


function word(dto: Partial<WordEntity>) {
    const entity = new WordEntity()

    for (const key of Object.keys(dto)) {
        if ((<any>dto)[key]) {
            (<any>entity)[key] = (<any>dto)[key]
        }
    }

    return entity
}


test('textColumns', () => {

    console.log(textColumns(
        ['apt', 'dilate', 'minute', 'ointment', 'scant', 'some new word'],
        ['/w_11', '/w_12', '/w_11', '/w_11', '/w_13', '/w_15'],
    ));

})



test('WordsList', () => {
    const elements = Array.from(WordsList({
        words: [
            word({ id: 1, theword: 'word' })
        ]
    }))

    console.log(elements);

})

