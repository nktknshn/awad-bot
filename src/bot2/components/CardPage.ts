import { Component } from "../../lib/elements"
import { button, buttonsRow, input, message, messagePart, nextMessage } from "../../lib/elements-constructors"
import { action, caseText, done, inputGroup2, next, on, otherwise } from "../../lib/input"
import { PathQuery } from "../../lib/util"
import { WithDispatcher } from "../app"
import { caseCard, caseCardUpdate, caseExample } from "../input"
import { WordEntityState } from "../store/user"
import { Card } from "./Card"

export function CardPageInput({
    word,
    dispatcher: { onReplaceWord, onUpdateWord, onAddExample }
}: WithDispatcher & { word: WordEntityState }) {

    return inputGroup2(
        on(caseText,
            action(m => m.startsWith('/')
                ? done()
                : next()
            )
        ),
        on(caseCard,
            action(card =>
                card.word == word.theword
                    ? onReplaceWord(word, card)
                    : done()
            ),
        ),
        on(caseExample,
            action((example) => onAddExample(word, example))
        ),
        on(caseCardUpdate,
            action(
                ({ tags, meanings }) =>
                    onUpdateWord(word, { tags, meanings })
                        .then(_ => true)
            )
        ),
        on(caseText,
            action(description =>
                !word.meanings.length
                    ? onUpdateWord(word, {
                        meanings: [{
                            description,
                            examples: [],
                        }]
                    })
                    : next()
            )
        ),
        on(caseText,
            action(messageText =>
                word.meanings.length
                    ? onAddExample(word, messageText)
                    : next()
            )
        ),
        otherwise(action(done))
    )
}

export function* CardPage({
    word, path, query,
    dispatcher
}: WithDispatcher & { word: WordEntityState, query?: PathQuery, path: string }) {
    const { onUpdateWord, onDeleteWord, onRedirect } = dispatcher
    yield CardPageInput({
        word,
        dispatcher
    })
    yield nextMessage()
    yield messagePart('')
    // yield messagePart('<pre>Copy the following card, make changes and send it back to edit the card.</pre>')
    yield messagePart(`<b>${word.theword}</b>`)
    yield nextMessage()

    const deleteConfirmation = query && query['delete']
    const rename = query && query['rename']

    yield buttonsRow(
        [
            // 'Add to trainer',
            'Pin',
            'Rename',
            deleteConfirmation ? '❗ Yes, delete!' : 'Delete'
        ],
        async (idx, data) => {

            data == 'Rename' &&
                await onRedirect(`${path}?rename=1`)

            data == 'Delete' &&
                await onRedirect(`${path}?delete=1`)

            data == '❗ Yes, delete!' &&
                await onRedirect('words?message=word_removed')
                    .then(() => onDeleteWord(word))
        }
    )

    yield Component(Card)({ word })

    if (rename) {
        yield input(({ messageText }) =>
            onUpdateWord(word, { word: messageText }).then(() => onRedirect(`${path}`)))
        yield message('Enter new word: ')
        yield button('Cancel', () => onRedirect(`${path}`))
    }

}