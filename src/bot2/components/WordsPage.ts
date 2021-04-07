import { flatten, map, sort, uniq } from "fp-ts/lib/Array"
import { eqString } from "fp-ts/lib/Eq"
import { pipe } from "fp-ts/lib/function"
import { fromNullable, map as mapO } from "fp-ts/lib/Option"
import { ordString } from "fp-ts/lib/Ord"
import { parseWordId } from "../../bot/utils"
import { CheckListStateless } from "../../lib/components/checklist"
import { button, buttonsRow, input, message, messagePart, nextMessage, radioRow } from "../../lib/elements-constructors"
import { InputHandlerData } from "../../lib/messages"
import { BasicElement, Component, ComponentConnected, ComponentElement, ComponentStateless, ComponentWithState, ConnectedComp, GetSetState } from "../../lib/elements"
import { Getter, toggleItem } from "../../lib/util"
import { AppDispatch } from "../app"
import { RootState } from "../store"
import { getUserAndSettings } from "../store/selectors"
import { WordEntityState } from "../store/user"
import { Card } from "./Card"
import { CardPageInput } from "./CardPage"
// import { CardPage } from "./CardPage"
import { WordsList } from "./WordsList"

type WordListFiltersType = 'All' | 'No meanings' | 'By tag'

interface WordsPageState {
    currentFilter: WordListFiltersType
    filteredTags: string[]
    openedWord?: WordEntityState
    showTagsPicker: boolean,
    wordId?: number
}

function containsAll<T>(subset: T[], set: T[]) {
    for (const item of subset) {
        if (set.indexOf(item) == -1) {
            return false
        }
    }
    return true
}

function filterTags(words: WordEntityState[], tags: string[]) {
    return words.filter(_ => containsAll(tags, _.tags))
}

function getAllTags(words: WordEntityState[]) {
    return pipe(words, map(_ => _.tags), flatten, uniq(eqString), sort(ordString))
}

function* WordsPageInput({ onWordId }: { onWordId: (wordId: number) => Promise<void> }) {
    yield input(async ({ messageText }, next) => {

        if (messageText && parseWordId(messageText)) {
            const [_, wordId] = parseWordId(messageText)!

            await onWordId(wordId)
            return
        }

        return await next()
    })
}


function* InputBox({ title, onCancel, onSuccess, onWrongInput, cancelTitle = 'Cancel' }: {
    title: string,
    cancelTitle?: string,
    onCancel: () => Promise<void>,
    onSuccess: (text: string) => Promise<void>,
    onWrongInput: (ctx: InputHandlerData) => Promise<void>,
}) {
    yield input(async (data, next) => {

        if (data.messageText) {
            await onSuccess(data.messageText)
            return
        }
        else {
            await onWrongInput(data)
        }

        return await next()
    })

    yield message(title)

    yield button(cancelTitle, () => onCancel())
}

export function* WordsPage(
    {
        user, settings, wordId, pinnedWordsIds,
        onRedirect, onReplaceWord, onUpdateWord, onAddExample, onDeleteWord, onTogglePinnedWord
    }: Getter<AppDispatch & RootState, 'user', 'settings', 'onRedirect', 'onReplaceWord', 'onUpdateWord', 
    'onAddExample', 'onDeleteWord', 'onTogglePinnedWord'> & { wordId?: number, pinnedWordsIds: number[] },
    { getState, setState }: GetSetState<WordsPageState>
) {

    if (!user)
        return

    const { currentFilter, filteredTags, showTagsPicker, wordId: openWordId } = getState({
        currentFilter: 'All',
        filteredTags: [],
        showTagsPicker: false,
        wordId
    })

    const allTags = getAllTags(user.words)
    let words = user.words

    if (currentFilter == 'All') {
        words = user.words
    }
    else if (currentFilter === 'No meanings') {
        words = user.words.filter(_ => !_.meanings.length)
    }
    else if (currentFilter === 'By tag') {
        words = filterTags(user.words, filteredTags)
    }

    yield Component(WordsPageInput)({
        onWordId: async (wordId) => {
            setState({ wordId })
            // await onRedirect(`words?wordId=${wordId}`)
        }
    })

    yield Component(WordsList)({ words, columns: settings.columns })

    yield radioRow(
        ['All', 'No meanings', 'By tag'],
        async (idx, data) => {
            setState({
                currentFilter: data as WordListFiltersType,
                showTagsPicker: data == 'By tag'
            })
        },
        currentFilter
    )

    yield button('Main', () => onRedirect('main'))

    if (showTagsPicker) {
        yield nextMessage()

        yield Component(CheckListStateless)({
            items: allTags.map(_ => _.slice(1)),
            selectedIds: pipe(filteredTags, map(_ => allTags.indexOf(_))),
            onClick: (idx) => setState({
                filteredTags: toggleItem(filteredTags, allTags[idx])
            })
        })

        yield button('Ok', () => setState({ showTagsPicker: false }))
    }

    const word = user.words.find(_ => _.id == openWordId)

    if (word) {

        const isPinned = user.pinnedWordsIds.indexOf(word.id) > -1

        yield nextMessage()
        yield Component(CardPage)({
            word, isPinned, onClose: () => setState({wordId: undefined}),
            onRedirect, onReplaceWord, onUpdateWord, onAddExample,
            onDeleteWord, onTogglePinnedWord
        })
    }
}


type Callback<K extends keyof any, T = never> = Record<K, (arg?: T) => Promise<void>>

type Dispatch<T> = Record<'dispatch', T>

function* CardPage({
    word, isPinned,
    onClose,
    onUpdateWord, onReplaceWord, onAddExample, onDeleteWord, onRedirect, onTogglePinnedWord
}: 
{ word: WordEntityState, isPinned: boolean } 
& Callback<'onClose'>
& Getter<AppDispatch, 'onUpdateWord', 'onReplaceWord', 'onAddExample', 'onDeleteWord', 'onRedirect', 'onTogglePinnedWord'>,
    { getState, setState }: GetSetState<{
        rename: boolean,
        deleteConfirmation: boolean,
        showMenu: boolean
    }>
) {
    const { rename, deleteConfirmation, showMenu } = getState({
        rename: false,
        deleteConfirmation: false,
        showMenu: false
    })

    yield Component(CardPageInput)({
        word,
        onUpdateWord, onReplaceWord, onAddExample, onDeleteWord, onRedirect
    })

    yield nextMessage()
    yield Component(Card)({ word })

    if (showMenu)
        yield buttonsRow(
            [
                // 'Add to trainer',
                isPinned ? 'Unpin' : 'Pin',
                'Rename',
                deleteConfirmation ? '❗ Yes, delete!' : 'Delete',
                'Close'
            ],
            async (idx, data) => {

                data == 'Close' && setState({ showMenu: false });

                (data == 'Unpin' || data == 'Pin') &&
                    await onTogglePinnedWord(word.id)

                data == 'Rename' &&
                    setState({ rename: true })

                data == 'Delete' &&
                    setState({ deleteConfirmation: true })

                data == '❗ Yes, delete!' &&
                    await onRedirect('words?message=word_removed')
                        .then(() => onDeleteWord(word))
            }
        )
    else {
        yield button('Menu', () => setState({ showMenu: true }))
        yield button('Close', onClose)
    }


    if (rename) {
        yield Component(InputBox)({
            title: 'Enter new word:',
            onSuccess: wordText => onUpdateWord(word, { word: wordText }),
            onCancel: () => setState({ rename: false }),
            onWrongInput: (data) => setState({ rename: false })
        })
    }

}
// 
const cnctd = ConnectedComp(WordsPage, getUserAndSettings)

export default cnctd
