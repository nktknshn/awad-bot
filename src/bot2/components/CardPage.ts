// import { Card } from "../../bot/components"
import { parseCard, parseCardUpdate, parseExample } from "../../bot/parsing"
import { WordEntity } from "../../database/entity/word"
import { button, buttonsRow, input, message, messagePart, nextMessage } from "../../lib/elements-constructors"
import { Component } from "../../lib/elements"
import { Getter, PathQuery } from "../../lib/util"
import { WithDispatcher } from "../app"
import { WordEntityState } from "../store/user"
import { Card } from "./Card"
import { inputGroup, inputOpt, messageText, parseCardOpt, parseCardUpdateOpt, parseExampleOpt } from "../input"
import { flow, identity } from "fp-ts/lib/function"
import * as O from 'fp-ts/lib/Option';

export function* CardPageInput({
    word,
    dispatcher: { onReplaceWord, onUpdateWord, onAddExample }
}: WithDispatcher & { word: WordEntityState }) {

    yield inputGroup(
        [
            (done, next) => flow(
                O.chain(messageText),
                O.map(m => m.startsWith('/')
                    ? done()
                    : next()
                )
            ),
            (done, next) => flow(
                O.chain(messageText),
                O.chain(parseCardOpt),
                O.map(card =>
                    card.word == word.theword
                        ? onReplaceWord(word, card)
                        : next()
                ),
            ),
            (done, next) => flow(
                O.chain(messageText),
                O.chain(parseExampleOpt),
                O.map((example) => onAddExample(word, example))
            ),
            (done, next) => flow(
                O.chain(messageText),
                O.chain(parseCardUpdateOpt),
                O.map(
                    ({ tags, meanings }) =>
                        onUpdateWord(word, { tags, meanings })
                            .then(_ => true)
                )
            ),
            (done, next) => flow(
                O.chain(messageText),
                O.map(description =>
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
            (done, next) => flow(
                O.chain(messageText),
                O.map(messageText =>
                    word.meanings.length
                        ? onAddExample(word, messageText)
                        : next()
                )
            ),
            (done, next) => flow(
                identity,
                O.map(done)
            )
        ]
    )
}

export function* CardPage({
    word, path, query,
    dispatcher
}: WithDispatcher & { word: WordEntityState, query?: PathQuery, path: string }) {
    const { onUpdateWord, onDeleteWord, onRedirect } = dispatcher
    yield Component(CardPageInput)({
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