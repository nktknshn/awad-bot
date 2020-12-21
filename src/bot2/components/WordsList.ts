import { WordEntity } from "../../database/entity/word";
import { message, messagePart } from "../../lib/helpers";
import { textColumns, zip } from "../../lib/util";
import { splitAt } from 'fp-ts/Array';
import { sortBy } from 'fp-ts/Array';
import { ord, ordString } from 'fp-ts/Ord';


// export function paginated

const sortByWord = sortBy(
    [ord.contramap(ordString, (w: WordEntity) => w.theword)]
);

export function* WordsList({ words, columns = 1 }: {
    words: WordEntity[];
    columns?: 1 | 2;
}) {
    words = [...words];

    const sorted = sortByWord(words);

    if (columns == 1) {
        for (const w of sorted) {
            yield messagePart(
                `<code>${textColumns([`[${w.meanings.length}] ${w.theword}`], [`</code>`], 20).join('')}/w_${w.id}`
            )
        }
    } else {

        const [left, right] = splitAt(Math.ceil(sorted.length / 2))(sorted);

        for (const [leftString, rightString] of zip(
            left.map(w => `<code>${textColumns([w.theword], [`</code>`], 20).join('')}/w_${w.id}`),
            right.map(w => `<code>${textColumns([w.theword], [`</code>`], 20).join('')}/w_${w.id}`)
        )) {
            yield messagePart(
                `${leftString ?? ''}       ${rightString ?? ''}`
            );
        }
    }
}
