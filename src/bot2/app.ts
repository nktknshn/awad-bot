import { Card } from "../bot/interfaces";
import { CardUpdate, parseCard, parseCardUpdate, parseExample, makeCardText, isEnglishWord, createCardFromWord } from "../bot/parsing";
import { parseCommand, range } from "../bot/utils";
import { UserEntity } from "../database/entity/user";
import { WordEntity } from "../database/entity/word";
import { button, buttonsRow, effect, input, message, nextMessage, radioRow } from "../lib/helpers";
import { UI } from "../lib/ui";
import { Getter, lastItem, parsePath, PathQuery } from "../lib/util";
import { Services } from "./services";
import { createStore, RootState } from "./store";
import { redirect } from "./store/path";
import { TrainerState, updateTrainer } from "./store/trainer";
import { addWord, saveWord, updateWord, addExample, deleteWord } from "./store/user";
import { Trainer } from "./trainer";
import { AppSettings, setColumns, updateSettings } from "./store/settings";
// import { Card as CardComponent } from "./components/Card";
import { CardPage } from "./components/CardPage";
import { WordsList } from "./components/WordsList";
import { Settings } from "./components/Settings";
import { ComponentGenerator } from "../lib/types";
import { useState } from "./mystore/state";
import { CheckList } from "../lib/components/checklist";
import { toggleIndex } from "./store/misc";

export type AppProps = RootState & AppActions

type AppActions = {
    onRedirect: (path: string) => Promise<any>
    onCard: (card: Card) => Promise<any>
    onUpdatedTrainer: (trainer: TrainerState) => Promise<any>
    onUpdateWord: (word: WordEntity, update: CardUpdate) => Promise<any>,
    onReplaceWord: (word: WordEntity, card: Card) => Promise<any>,
    onAddExample: (word: WordEntity, example: string) => Promise<any>,
    onDeleteWord: (word: WordEntity) => Promise<any>,
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
        ...store.getState(),
        onRedirect: async path => store.dispatch(redirect(path)),
        onCard: async card => {
            const userPayload = await store.dispatch(addWord(card))
            const user: UserEntity = userPayload.payload as UserEntity
            const word = lastItem([...user.words].sort((a, b) => a.id - b.id))
            console.log(user.words.map(w => w.theword));
            store.dispatch(redirect(`/w_${word!.id}`))
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
        else if (parseCommand(messageText)) {
            onRedirect(messageText)
        }
        else
            await onRedirect('main?message=bad_card')
    });

}

// function component<P>(comp: (props: P) => ComponentGenerator, props: P) {
//     // comp.name
//     return comp(props)
// }

export function* App({
    user, path, trainer, settings, misc,
    onRedirect, onCard, onUpdateWord, onReplaceWord, onUpdatedTrainer, 
    onAddExample, onDeleteWord, onUpdateSettings, onToggleOption
}: AppProps) {
    
    const { pathname, query } = parsePath(path)
    const titleMessage = query && 'message' in query
        ? String(query['message'])
        : undefined

    console.log(`Rendering App ${pathname} ${JSON.stringify(query)}`);

    if (!user) {
        yield message('Loading profile...')
        return
    }

    if (pathname == 'main') {
        // yield component(AppInput, { onRedirect, onCard })

        yield AppInput({ onRedirect, onCard })
        yield MainMenu({ user, titleMessage, onRedirect })
    }
    else if (pathname == 'components') {
        yield CheckList({
            items: [
                'option one',
                'second option',
                'and third one',
                'also 4th',
                'lenovo thinkpad'
            ],
            selectedIds: misc.selectedIds,
            onClick: async index => {
                await onToggleOption(index)
            }
        })
        yield button('Back', () => onRedirect('main'))
    }
    else if (pathname == 'stats') {
        yield effect(() => onRedirect('main?message=not_ready'))
    }
    else if (pathname == 'random') {
        yield effect(() => onRedirect('main?message=not_ready'))
    }
    else if (pathname == 'trainer') {
        yield Trainer({ user, trainer, onRedirect, onUpdated: onUpdatedTrainer })
    }
    else if (pathname == 'settings') {
        yield Settings({ settings, onUpdateSettings })
        yield button('Back', () => onRedirect('main'))
    }
    else if (pathname == 'words' || pathname == '/words') {
        yield AppInput({ onRedirect, onCard })
        yield WordsList({ words: user.words, columns: settings.columns })
        yield WordsListSettings({ showFilters: true })
        yield button('Back', () => onRedirect('main'))
    }
    else if (pathname && parseCommand(pathname)) {
        const [cmdPath, id] = parseCommand(pathname)!
        if (cmdPath == 'w') {
            const word = user.words.find(w => w.id == id)
            if (word) {
                console.log(`Card page for ${word.id}`);

                yield AppInput({ onRedirect, onCard })
                yield WordsList({ words: user.words, columns: settings.columns })
                yield button('Back', () => onRedirect('words'))
                yield CardPage({
                    user, word, query, path: pathname,
                    onReplaceWord, onUpdateWord, onAddExample,
                    onDeleteWord, onRedirect
                })
            } else {
                yield effect(() => onRedirect('main?message=not_found'))
            }
        }
    }
}


function* MainMenu({ user, onRedirect, titleMessage }: {
    user: UserEntity,
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


type WordsListSettingsProps = {
    showFilters: boolean
}

export function* WordsListSettings({ showFilters = true }: WordsListSettingsProps) {

    // const [showFilters, setShowFilters] = useState(false)
    // const [page, setPage] = useState(0)

    // if (showFilters())
    //     yield message('FILTERS')

    if (showFilters) {
        yield WordListFilters({ enabledFilter: 'All' })
    }
}

type WordListFiltersType = 'All' | 'No meanings' | 'By tag'

type WordListFiltersProps = {
    enabledFilter: WordListFiltersType
}

export function* WordListFilters({
    enabledFilter
}: WordListFiltersProps) {
    yield radioRow(
        [
            'All', 'No meanings', 'By tag'
        ],
        async (idx, data) => {

        },
        enabledFilter
    )
}