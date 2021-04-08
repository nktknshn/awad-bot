import { pipe } from "fp-ts/lib/function";
import { map as mapOpt, toUndefined } from "fp-ts/lib/Option";
import { Card as CardType } from "../bot/interfaces";
import { CardUpdate, createCardFromWord, isEnglishWord, parseCard } from "../bot/parsing";
import { parseWordId } from "../bot/utils";
import { UserEntity } from "../database/entity/user";
import { Component, ConnectedComp, WithContext } from "../lib/elements";
import { button as _button, buttonsRow, effect, input as _input, message } from "../lib/elements-constructors";
import { combine } from "../lib/state";
import { lastItem, parsePath, tryKey } from "../lib/util";
import { Settings } from "./components/Settings";
import { Trainer } from "./components/trainer";
import WordsPage from "./components/WordsPage";
import PinnedCards from "./connected/PinnedCards";
import { createAwadStore } from "./store";
import { toggleIndex } from "./store/misc";
import { redirect } from "./store/path";
import { getDispatcher, getIfUserLoaded, getPath, getSettings, getTrainer, getUser } from "./store/selectors";
import { AppSettings, updateSettings } from "./store/settings";
import { TrainerState, updateTrainer } from "./store/trainer";
import { addExample, addWord, deleteWord, saveWord, togglePinnedWord, updateWord, UserEntityState, WordEntityState } from "./store/user";


export type AppDispatch<R = Promise<any>> = {
    onRedirect: (path: string) => R
    onCard: (card: CardType) => R
    onUpdatedTrainer: (trainer: TrainerState) => R
    onUpdateWord: (word: WordEntityState, update: CardUpdate) => R,
    onReplaceWord: (word: WordEntityState, card: CardType) => R,
    onAddExample: (word: WordEntityState, example: string) => R,
    onDeleteWord: (word: WordEntityState) => R,
    onUpdateSettings: (settings: Partial<AppSettings>) => R,
    onToggleOption: (idx: number) => R,
    onTogglePinnedWord: (idx: number) => R,
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

export type WithDispatcher = { dispatcher: AppDispatch }

const { input, button } = contexted<WithDispatcher>()

function* AppInput() {
    yield input(({ dispatcher: { onCard, onRedirect } }) => async ({ messageText }, next) => {
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
            await onRedirect(messageText)
        }
        else
            await onRedirect('main?message=bad_card')
    })
}

type MappedAppProps = {
    path: string
    userLoaded: boolean
}

export function* MappedApp({
    path, userLoaded, dispatcher
}: MappedAppProps & WithDispatcher) {

    const { pathname, query } = parsePath(path)
    const titleMessage = pipe(tryKey('message', query), mapOpt(String), toUndefined)

    if (!userLoaded) {
        yield message('Loading profile...')
        return
    }

    yield PinnedCards({ onUnpin: dispatcher.onTogglePinnedWord })

    if (pathname == 'main') {
        yield Component(AppInput)(dispatcher)
        yield ConnectedComp(MainMenu, combine(getDispatcher, getUser))({ titleMessage })
    }
    else if (pathname == 'settings') {
        yield ConnectedComp(Settings, combine(getDispatcher, getSettings))({})
        yield button('Back', ({ dispatcher }) => () => dispatcher.onRedirect('main'))
    }
    else if (pathname == 'trainer') {
        yield ConnectedComp(Trainer, combine(getTrainer, getUser))
            ({ onRedirect: dispatcher.onRedirect, onUpdated: dispatcher.onUpdatedTrainer })
    }
    else if (pathname == 'words' || pathname == '/words') {
        const wordId = pipe(tryKey('wordId', query), mapOpt(Number), toUndefined)
        yield Component(AppInput)(dispatcher)

        yield WordsPage({ wordId })
    }
    else {
        yield effect(() => dispatcher.onRedirect('main?message=not_ready'))
    }

}

function* MainMenu({ user, titleMessage, dispatcher: { onRedirect } }: {
    user: UserEntityState,
    titleMessage?: string,
} & WithDispatcher) {
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


function contexted<Context>() {

    type NthArg<T extends (...args: any) => any, N extends number> = Parameters<T>[N]

    type Z = NthArg<typeof _input, 0>

    const input = function (
        callback: (ctx: Context) => NthArg<typeof _input, 0>
    ) {
        return new WithContext(
            (ctx: Context) => _input(callback(ctx))
        )
    }

    const button =
        (
            text: string,
            callback: ((ctx: Context) => () => Promise<any>)
        ) => new WithContext((ctx: Context) => _button(text, callback(ctx)))

    return {
        input,
        button
    }
}


export default ConnectedComp(
    MappedApp,
    combine(getDispatcher, combine(getIfUserLoaded, getPath))
)
