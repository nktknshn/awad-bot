// import { Card } from "../../bot/components"
import { parseCard, parseCardUpdate, parseExample } from "../../bot/parsing"
import { WordEntity } from "../../database/entity/word"
import { button, buttonsRow, input, message, messagePart, nextMessage } from "../../lib/elements-constructors"
import { Component } from "../../lib/elements"
import { Getter, PathQuery } from "../../lib/util"
import { AppDispatch } from "../app"
import { RootState } from "../store"
import { WordEntityState } from "../store/user"
import { Card } from "./Card"

export function* CardPageInput({
    word,
    onReplaceWord, onUpdateWord, onAddExample, onDeleteWord, onRedirect
}: Getter<AppDispatch, 'onUpdateWord', 'onReplaceWord', 'onAddExample', 'onDeleteWord', 'onRedirect'> & { word: WordEntityState }) {
    yield input(async ({ messageText }, next) => {
        if (!messageText) {
            return
        }

        if (messageText.startsWith('/')) {
            return await next()
        }

        const card = parseCard(messageText)

        if (card && card.word == word.theword) {
            await onReplaceWord(word, card)
            return
        }
        else if (card) {
            return await next()
        }
        else if (parseExample(messageText)) {
            const example = parseExample(messageText)
            await onAddExample(word, example!)
            return
        }
        else if (parseCardUpdate(messageText)) {
            const { tags, meanings } = parseCardUpdate(messageText)!
            await onUpdateWord(word, { tags, meanings })
            return true
        }
        else if (!word.meanings.length) {
            await onUpdateWord(word, {
                // tags: word.tags,
                meanings: [{
                    description: messageText,
                    examples: [],
                }]
            })
            return true
        }
        else if (word.meanings.length) {
            await onAddExample(word, messageText)
            return true
        }
        else {
            return await next()
        }
    })
}

export function* CardPage({
    user, word, path, query,
    onReplaceWord, onUpdateWord, onAddExample, onDeleteWord, onRedirect
}: Getter<AppDispatch & RootState, 'user', 'onUpdateWord', 'onReplaceWord', 'onAddExample', 'onDeleteWord', 'onRedirect'> & { word: WordEntityState, query?: PathQuery, path: string }) {

    yield Component(CardPageInput)({
        word,
        onUpdateWord, onReplaceWord, onAddExample, onDeleteWord, onRedirect
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