import { Component } from "../../lib/component"
import { button, buttonsRow, input, message, messagePart, nextMessage } from "../../lib/elements-constructors"
import { action, caseText, nextHandler, inputHandler, nextMatcher, on, otherwise, ifTrue } from "../../lib/input"
import { PathQuery } from "../../lib/util"
import { caseCard, caseCardUpdate, caseExample } from "../input"
import { WordEntityState } from "../store/user"
import { Card } from "./Card"
import * as O from 'fp-ts/lib/Option';
import { flow, identity } from "fp-ts/lib/function";
import { WithDispatcher } from "../storeToDispatch"


export function CardPageInput({
    word,
    dispatcher: { onReplaceWord, onUpdateWord, onAddExample }
}: WithDispatcher<{ word: WordEntityState }>) {

    return inputHandler(
        [on(caseText,
            action(({ messageText }) => messageText.startsWith('/')
                ? nextHandler()
                : nextMatcher()
            )
        ),
        on(caseCard,
            action(({ card }) =>
                card.word == word.theword
                    ? onReplaceWord(word, card)
                    : nextHandler()
            ),
        ),
        on(caseExample,
            action(({ example }) => onAddExample(word, example))
        ),
        on(caseCardUpdate,
            action(
                ({ tags, meanings }) =>
                    onUpdateWord(word, { tags, meanings })
                        .then(_ => true)
            )
        ),
        on(caseText,
            ifTrue(() => Boolean(!word.meanings.length)),
            action(({ messageText: description }) =>
                onUpdateWord(word, {
                    meanings: [{
                        description,
                        examples: [],
                    }]
                })
            )
        ),
        on(caseText,
            ifTrue(() => Boolean(word.meanings.length)),
            action(({ messageText }) => onAddExample(word, messageText))
        ),
        on(otherwise, action(nextHandler))
        ])
}

export function* CardPage({
    word, path, query,
    dispatcher
}: WithDispatcher<{ word: WordEntityState, query?: PathQuery, path: string }>) {
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

    yield Card({ word })

    if (rename) {
        yield input(({ messageText }) =>
            onUpdateWord(word, { word: messageText }).then(() => onRedirect(`${path}`)))
        yield message('Enter new word: ')
        yield button('Cancel', () => onRedirect(`${path}`))
    }

}