import { exampleSymbol, descriptionSymbol } from "../../bot/parsing";
import { WordEntity } from "../../database/entity/word";
import { messagePart } from "../../lib/helpers";

export function* Card({ word }: { word: WordEntity; }) {
    yield messagePart(`><b> ${word.theword}</b>`);

    if (word.tags.length)
        yield messagePart(word.tags.join(' '));

    if (word.transcription)
        yield messagePart(word.transcription);

    for (const meaning of word.meanings) {
        yield messagePart('');
        yield messagePart(`${descriptionSymbol} ${meaning.description}`);
        for (const example of meaning.examples)
            yield messagePart(`<i>${exampleSymbol} ${example}</i>`);
    }
}
