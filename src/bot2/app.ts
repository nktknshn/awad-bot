import { pipe } from "fp-ts/lib/function";
import { map as mapOpt, toUndefined } from "fp-ts/lib/Option";
import { Card as CardType } from "../bot/interfaces";
import { CardUpdate, createCardFromWord, isEnglishWord, parseCard } from "../bot/parsing";
import { parseWordId } from "../bot/utils";
import { UserEntity } from "../database/entity/user";
import { button, buttonsRow, effect, input, message } from "../lib/elements-constructors";
import { Component, ConnectedComp } from "../lib/elements";
import { Getter, lastItem, parsePath, tryKey } from "../lib/util";
import { Settings } from "./components/Settings";
import WordsPage from "./components/WordsPage";
import PinnedCards from "./connected/PinnedCards";
import { createAwadStore, RootState } from "./store";
import { toggleIndex } from "./store/misc";
import { redirect } from "./store/path";
import { combine, getSettings, getUser, getUserAndSettings } from "./store/selectors";
import { AppSettings, updateSettings } from "./store/settings";
import { TrainerState, updateTrainer } from "./store/trainer";
import { addExample, addWord, deleteWord, saveWord, togglePinnedWord, updateWord, UserEntityState, WordEntityState } from "./store/user";
import { Trainer } from "./components/trainer";


export type AppDispatch = {
    onRedirect: (path: string) => Promise<any>
    onCard: (card: CardType) => Promise<any>
    onUpdatedTrainer: (trainer: TrainerState) => Promise<any>
    onUpdateWord: (word: WordEntityState, update: CardUpdate) => Promise<any>,
    onReplaceWord: (word: WordEntityState, card: CardType) => Promise<any>,
    onAddExample: (word: WordEntityState, example: string) => Promise<any>,
    onDeleteWord: (word: WordEntityState) => Promise<any>,
    onUpdateSettings: (settings: Partial<AppSettings>) => Promise<any>,
    onToggleOption: (idx: number) => Promise<any>,
    onTogglePinnedWord: (idx: number) => Promise<any>,
}

const messages: Record<string, string> = {
    'word_added': '👌 Word added',
    'bad_card': '❌ Bad card',
    'not_found': '❌ Word wasn\'t found',
    'word_removed': '👌 Word removed',
    'not_ready': '❌ The component isn\'t ready yet',
}

export function storeToDispatch(store: ReturnType<typeof createAwadStore>): AppDispatch {
    return {
        onRedirect: async path => store.dispatch(redirect(path)),
        onCard: async card => {
            const userPayload = await store.dispatch(addWord(card))
            const user: UserEntity = userPayload.payload as UserEntity
            const word = lastItem([...user.words].sort((a, b) => a.id - b.id))
            console.log(user.words.map(w => w.theword));
            store.dispatch(redirect(`/words?wordId=${word!.id}`))
        },
        onUpdatedTrainer: async trainer =>
            store.dispatch(updateTrainer(trainer)),
        onUpdateWord: async (word, update) =>
            store.dispatch(updateWord({ word, update })),
        onReplaceWord: async (word, card) =>
            store.dispatch(saveWord({ word, card })),
        onAddExample: async (word, example) =>
            store.dispatch(addExample({ word, example })),
        onDeleteWord: word => store.dispatch(deleteWord(word)),
        onUpdateSettings: async settings => store.dispatch(updateSettings(settings)),

        onToggleOption: async idx => store.dispatch(toggleIndex(idx)),
        onTogglePinnedWord: async idx => store.dispatch(togglePinnedWord(idx)),
    }
}

function* AppInput({ onRedirect, onCard }: Getter<AppDispatch, 'onRedirect', 'onCard'>) {
    yield input(async ({ messageText }) => {
        if (!messageText)
            return

        if (isEnglishWord(messageText)) {
            await onCard(createCardFromWord(messageText))
            return
        }

        const card = parseCard(messageText)

        if (card) {
            await onCard(card)
        }
        else if (parseWordId(messageText)) {
            onRedirect(messageText)
        }
        else
            await onRedirect('main?message=bad_card')
    });

}

type MappedAppProps = {
    path: string
    userLoaded: boolean
}

export function* MappedApp({
    path, userLoaded,
    onRedirect, onCard, onUpdateWord, onReplaceWord, onUpdatedTrainer,
    onAddExample, onDeleteWord, onUpdateSettings, onToggleOption,
    onTogglePinnedWord
}: AppDispatch & MappedAppProps) {

    const { pathname, query } = parsePath(path)
    const titleMessage = pipe(tryKey('message', query), mapOpt(String), toUndefined)

    if (!userLoaded) {
        yield message('Loading profile...')
        return
    }

    yield PinnedCards({ onUnpin: onTogglePinnedWord })

    if (pathname == 'main') {
        yield Component(AppInput)({ onRedirect, onCard })
        yield ConnectedComp(MainMenu, getUser)({ titleMessage, onRedirect })
    }
    else if (pathname == 'settings') {
        yield ConnectedComp(Settings, getSettings)({ onUpdateSettings })
        yield button('Back', () => onRedirect('main'))
    }
    else if (pathname == 'trainer') {
        yield ConnectedComp(Trainer,
            ({ user, trainer }: RootState) => ({ user, trainer }))
            ({ onRedirect, onUpdated: onUpdatedTrainer })
    }
    else if (pathname == 'words' || pathname == '/words') {
        const wordId = pipe(tryKey('wordId', query), mapOpt(Number), toUndefined)
        yield Component(AppInput)({ onRedirect, onCard })

        yield WordsPage({
            wordId, onRedirect, onReplaceWord, onUpdateWord,
            onAddExample, onDeleteWord, onTogglePinnedWord
        })
    }
    else {
        yield effect(() => onRedirect('main?message=not_ready'))
    }
}

function* MainMenu({ user, onRedirect, titleMessage }: {
    user: UserEntityState,
    titleMessage?: string,
    onRedirect: (path: string) => Promise<void>
}) {
    yield message([
        titleMessage ? `${messages[titleMessage]}` : ``,
        `Hello, You have ${user.words.length} words in your database.`
    ])

    yield buttonsRow([
        ['My words', 'words'],
        ['Components', 'components'],
        // ['Tags', 'tags'],
        // ['Statistics', 'stats'],
        // ['Random word', 'random'],
        ['Train', 'trainer'],
    ],
        (_, path) => onRedirect(path))

    yield buttonsRow(
        [
            ['Settings', 'settings'],
            ['Minimize', 'main'],
        ],
        (_, path) => onRedirect(path)
    )
}

export default ConnectedComp(MappedApp,
    ({ path, user }: RootState) => ({ path, userLoaded: !!user }))