import { exampleSymbol, descriptionSymbol } from "../../bot/parsing";
import { WordEntity } from "../../database/entity/word";
import { Component } from "../../lib/elements";
import { messagePart } from "../../lib/elements-constructors";
import { WordEntityState } from "../store/user";

export const Card = Component(
    function* Card({ word }: { word: WordEntityState }) {
        yield messagePart(`><b> ${word.theword}</b>`);
    
        if (word.tags.length)
            yield messagePart(word.tags.join(' '));
    
        if (word.transcription)
            yield messagePart(word.transcription);
    
        // for(const translation of word.translations) {}
    
        yield messagePart(word.translations.join(', '))
    
        for (const meaning of word.meanings) {
            yield messagePart('');
            yield messagePart(`${descriptionSymbol} ${meaning.description}`);
            for (const example of meaning.examples)
                yield messagePart(`<i>${exampleSymbol} ${example}</i>`);
        }
    
        // yield new ABCD()
    }
)

class ABCD {}
