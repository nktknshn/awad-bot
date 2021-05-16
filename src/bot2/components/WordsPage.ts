import { flatten, map, sort, uniq } from "fp-ts/lib/Array"
import { eqString } from "fp-ts/lib/Eq"
import { pipe } from "fp-ts/lib/function"
import { ordString } from "fp-ts/lib/Ord"
import { CheckListStateless } from "../../lib/components/checklist"
import { Component, connected2 } from "../../lib/component"
import { button, buttonsRow, input, message, nextMessage, radioRow } from "../../lib/elements-constructors"
import { action, caseText, inputHandler, nextHandler, nextHandlerAction, on, otherwise } from "../../lib/input"
import { select } from "../../lib/state"
import { toggleItem } from "../../lib/util"
import { caseWordId } from "../input"
import { getDispatcher, getSettings, getUser } from "../store/selectors"
import { WordEntityState } from "../store/user"
import { Card } from "./Card"
import { CardPageInput } from "./CardPage"
import { WordsList } from "./WordsList"
import { WithDispatcher } from "../storeToDispatch"
import { GetSetState } from "Lib/tree2"
import { InputHandlerData } from "Lib/textmessage"

type WordListFiltersType = 'All' | 'No meanings' | 'By tag'

interface WordsPageState {
  currentFilter: WordListFiltersType
  filteredTags: string[]
  openedWord?: WordEntityState
  showTagsPicker: boolean,
  wordId?: number
}

function WordsPageInput<R>({ onWordId }: { onWordId: (wordId: number) => R }) {
  return inputHandler(
    [
      on(caseWordId, action(a => [onWordId(a.example)])),
      on(otherwise, nextHandlerAction)
    ]
  )
}

const WordsPage = connected2(
  select(getUser, getSettings, getDispatcher),
  ({ user, settings, dispatcher }) =>
    function* WordsPage(
      { wordId, }: { wordId?: number, },
      { getState, setState, lenses }: GetSetState<WordsPageState>
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

      yield WordsPageInput({
        onWordId: (wordId) =>
          setState(lenses('wordId').set(wordId))

      })

      yield Component(WordsList)({ words, columns: settings.columns })

      yield radioRow(
        ['All', 'No meanings', 'By tag'],
        (idx, data) =>
          [
            setState(lenses('currentFilter').set(data as WordListFiltersType)),
            setState(lenses('showTagsPicker').set(data == 'By tag')),
          ],
        currentFilter)


      yield button('Main', () => dispatcher.onRedirect('main'))

      if (showTagsPicker) {
        yield nextMessage()

        yield CheckListStateless({
          items: allTags.map(_ => _.slice(1)),
          selectedIds: pipe(filteredTags, map(_ => allTags.indexOf(_))),
          onClick: (idx) => setState(
            lenses('filteredTags').set(toggleItem(filteredTags, allTags[idx]))
            // filteredTags: toggleItem(filteredTags, allTags[idx])
          )
        })

        yield button('Ok', () => setState(lenses('showTagsPicker').set(false)))
      }

      const word = user.words.find(_ => _.id == openWordId)

      if (word) {

        const isPinned = user.pinnedWordsIds.indexOf(word.id) > -1

        yield nextMessage()
        yield CardPage({ word, isPinned, onClose: () => setState(lenses('wordId').set(undefined)), dispatcher })
      }
    }
)

// type Callback<K extends keyof any, T = never> = Record<K, <R>(arg?: T) => R>

type LocalState = {
  rename: boolean,
  deleteConfirmation: boolean,
  showMenu: boolean
}

const CardPage = Component(
  function*  <R>({
    word, isPinned, dispatcher, onClose
  }: { word: WordEntityState, isPinned: boolean } & { onClose: () => R } & WithDispatcher,
    { getState, setState, lenses }: GetSetState<LocalState>
  ) {
    const { rename, deleteConfirmation, showMenu, } = getState({
      rename: false,
      deleteConfirmation: false,
      showMenu: false
    })

    yield CardPageInput({ word, dispatcher })

    yield nextMessage()
    yield Card({ word })

    if (showMenu)
      yield buttonsRow(
        [
          // 'Add to trainer',
          isPinned ? 'Unpin' : 'Pin',
          'Rename',
          deleteConfirmation ? '❗ Yes, delete!' : 'Delete',
          'Close'
        ],
        (idx, data) => {

          if (data == 'Close') return setState(lenses('showMenu').set(false));

          if (data == 'Unpin' || data == 'Pin')
            return dispatcher.onTogglePinnedWord(word.id)

          if (data == 'Rename')
            return setState(lenses('rename').set(true))

          if (data == 'Delete')
            return setState(lenses('deleteConfirmation').set(true))

          if (data == '❗ Yes, delete!')
            return dispatcher.onDeleteWord(word)
              .then(() => dispatcher.onDeleteWord(word))
        }
      )
    else {
      yield button('Menu', () => setState(lenses('showMenu').set(true)))
      yield button('Close', onClose)
    }


    if (rename) {
      yield Component(InputBox)({
        title: 'Enter new word:',
        onSuccess: wordText => dispatcher.onUpdateWord(word, { word: wordText }),
        onCancel: () => setState(lenses('rename').set(false)),
        onWrongInput: (data) => setState(lenses('rename').set(false))
      })
    }

  }
)

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


export function* InputBox<R1, R2, R3>({ title, onCancel, onSuccess, onWrongInput, cancelTitle = 'Cancel' }: {
  title: string,
  cancelTitle?: string,
  onCancel: () => R1,
  onSuccess: (text: string) => R2,
  onWrongInput: (ctx: InputHandlerData) => R3,
}) {

  yield inputHandler([
    on(caseText, action(({ messageText }) => onSuccess(messageText))),
    on(otherwise, action(a => onWrongInput(a.data))),
    action(nextHandler)
  ])

  yield message(title)

  yield button(cancelTitle, () => onCancel())
}

export default WordsPage
