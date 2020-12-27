import { pipe } from "fp-ts/lib/function";
import { map as mapOpt, none, some, toUndefined } from "fp-ts/lib/Option";
import { ParsedUrlQuery } from "querystring";
import { Card } from "../bot/interfaces";
import { CardUpdate, createCardFromWord, isEnglishWord, parseCard } from "../bot/parsing";
import { parseWordId } from "../bot/utils";
import { UserEntity } from "../database/entity/user";
import { button, buttonsRow, effect, input, message, messagePart, nextMessage } from "../lib/constructors";
import { CompConstructorWithState, Component, ComponentConnected, ComponentElement, ComponentStateless, ComponentWithState, ConnectedComp, GetSetState } from "../lib/types";
import { UI } from "../lib/ui";
import { Getter, lastItem, parsePath, tryKey } from "../lib/util";
// import { Card as CardComponent } from "./components/Card";
import { CardPage } from "./components/CardPage";
import { Settings } from "./components/Settings";
import { WordsList } from "./components/WordsList";
import { WordsPage } from "./components/WordsPage";
import { Services } from "./services";
import { createStore, RootState } from "./store";
import { toggleIndex } from "./store/misc";
import { redirect } from "./store/path";
// import { getUser } from "./store/selectors";
import { AppSettings, updateSettings } from "./store/settings";
import { TrainerState, updateTrainer } from "./store/trainer";
import { addExample, addWord, deleteWord, saveWord, updateWord, UserEntityState, WordEntityState } from "./store/user";
import { Trainer } from "./trainer";

export type AppProps = AppActions
// export type AppProps = RootState & AppActions

type AppActions = {
    onRedirect: (path: string) => Promise<any>
    onCard: (card: Card) => Promise<any>
    onUpdatedTrainer: (trainer: TrainerState) => Promise<any>
    onUpdateWord: (word: WordEntityState, update: CardUpdate) => Promise<any>,
    onReplaceWord: (word: WordEntityState, card: Card) => Promise<any>,
    onAddExample: (word: WordEntityState, example: string) => Promise<any>,
    onDeleteWord: (word: WordEntityState) => Promise<any>,
    onUpdateSettings: (settings: Partial<AppSettings>) => Promise<any>,
    onToggleOption: (idx: number) => Promise<any>,
}

const messages: Record<string, string> = {
    'word_added': '👌 Word added',
    'bad_card': '❌ Bad card',
    'not_found': '❌ Word wasn\'t found',
    'word_removed': '👌 Word removed',
    'not_ready': '❌ The component isn\'t ready yet',
}

export function stateToProps(store: ReturnType<typeof createStore>, ui: UI, services: Services): AppProps {
    return {
        // ...store.getState(),
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
    }
}

function* AppInput({ onRedirect, onCard }: Getter<AppProps, 'onRedirect', 'onCard'>) {
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

const getUser: Selector<RootState> = ({ user }) => ({ user })
const getSettings: Selector<RootState> = ({ settings }: RootState) => ({ settings })
const getUserAndSettings = combine(getUser, getSettings)

type Selector<S, R = any> = (state: S) => R

function combine<S, R1, R2>(
    sel1: Selector<S, R1>,
    sel2: Selector<S, R2>,
): Selector<S, R1 & R2> {
    return function(state) {
        return {...sel1(state), ... sel2(state)}
    }
}

type MappedAppProps = {
    path: string
    userLoaded: boolean
}

export function* MappedApp({
    path, userLoaded,
    onRedirect, onCard, onUpdateWord, onReplaceWord, onUpdatedTrainer,
    onAddExample, onDeleteWord, onUpdateSettings, onToggleOption
}: AppProps & MappedAppProps) {

    const { pathname, query } = parsePath(path)
    const titleMessage = pipe(tryKey('message', query), mapOpt(String), toUndefined)

    if (!userLoaded) {
        yield message('Loading profile...')
        return
    }

    if (pathname == 'main') {
        yield Component(AppInput)({ onRedirect, onCard })
        yield ConnectedComp(MainMenu, getUser)({ titleMessage, onRedirect })
    }
    else if (pathname == 'settings') {
        yield ConnectedComp(Settings, getSettings)({ onUpdateSettings })
        yield button('Back', () => onRedirect('main'))
    }
    else if (pathname == 'words' || pathname == '/words') {
        const wordId = pipe(tryKey('wordId', query), mapOpt(Number), toUndefined)
        yield Component(AppInput)({ onRedirect, onCard })
        yield ConnectedComp(WordsPage, getUserAndSettings)({
            wordId, onRedirect, onReplaceWord, onUpdateWord, onAddExample, onDeleteWord
        })
    }
    else {
        yield effect(() => onRedirect('main?message=not_ready'))
    }
}

export function* App({
    user, path, trainer, settings, misc,
    onRedirect, onCard, onUpdateWord, onReplaceWord, onUpdatedTrainer,
    onAddExample, onDeleteWord, onUpdateSettings, onToggleOption
}: AppProps & RootState,
    // { getState, setState }: GetSetState<{ wordId: number }>
) {

    // const { wordId } = getState({ wordId: true })

    const { pathname, query } = parsePath(path)
    const titleMessage = pipe(tryKey('message', query), mapOpt(String), toUndefined)

    console.log(`Rendering App ${pathname} ${JSON.stringify(query)}`);

    if (!user) {
        yield message('Loading profile...')
        return
    }

    // yield Component(Component1)({
    //     wordsTitles: user.words.map(_ => _.theword)
    // })

    if (pathname == 'main') {
        yield Component(AppInput)({ onRedirect, onCard })
        yield Component(MainMenu)({ user, titleMessage, onRedirect })
    }
    else if (pathname == 'stats') {
        yield effect(() => onRedirect('main?message=not_ready'))
    }
    else if (pathname == 'random') {
        yield effect(() => onRedirect('main?message=not_ready'))
    }
    else if (pathname == 'trainer') {
        yield Component(Trainer)({
            user, trainer,
            onRedirect, onUpdated: onUpdatedTrainer
        })
    }
    else if (pathname == 'settings') {
        yield Component(Settings)({ settings, onUpdateSettings })
        yield button('Back', () => onRedirect('main'))
    }
    else if (pathname == 'words' || pathname == '/words') {
        const wordId = pipe(tryKey('wordId', query), mapOpt(Number), toUndefined)
        yield Component(AppInput)({ onRedirect, onCard })
        yield ComponentWithState(WordsPage)({
            user, settings, wordId,
            onRedirect, onReplaceWord, onUpdateWord, onAddExample, onDeleteWord
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
