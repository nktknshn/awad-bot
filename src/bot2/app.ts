import { Card } from "../bot/interfaces";
import { CardUpdate, parseCard, parseCardUpdate, parseExample, makeCardText, exampleSymbol, descriptionSymbol } from "../bot/parsing";
import { parseCommand, range } from "../bot/utils";
import { UserEntity } from "../database/entity/user";
import { WordEntity } from "../database/entity/word";
import { button, buttonsRow, effect, input, message, messagePart, nextMessage, radioRow } from "../lib/helpers";
import { Keyboard } from "../lib/types";
import { UI } from "../lib/ui";
import { lastItem, parsePath, PathQuery, textColumns, zip } from "../lib/util";
import { Services } from "./services";
import { createStore, RootState } from "./store";
import { redirect } from "./store/path";
import { TrainerState, updateTrainer } from "./store/trainer";
import { addWord, saveWord, updateWord, addExample, deleteWord } from "./store/user";
import { Trainer } from "./trainer";
import { splitAt } from 'fp-ts/Array'

// type GetProps<A extends keyof AppProps> = Pick<AppProps, A>
type GetProps<
    A extends keyof AppProps,
    B extends keyof AppProps = never,
    C extends keyof AppProps = never,
    D extends keyof AppProps = never,
    E extends keyof AppProps = never,
    F extends keyof AppProps = never,
    G extends keyof AppProps = never,
    H extends keyof AppProps = never,
    I extends keyof AppProps = never,
    > = Pick<AppProps, A | B | C | D | E | F | G | H | I>

type AppProps = RootState & AppActions

type AppActions = {
    onRedirect: (path: string) => Promise<any>
    onCard: (card: Card) => Promise<any>
    onUpdatedTrainer: (trainer: TrainerState) => Promise<any>
    onUpdateWord: (word: WordEntity, update: CardUpdate) => Promise<any>,
    onReplaceWord: (word: WordEntity, card: Card) => Promise<any>,
    onAddExample: (word: WordEntity, example: string) => Promise<any>,
    onDeleteWord: (word: WordEntity) => Promise<any>,
    onUpdateSettings: (settings: Partial<AppSettings>) => Promise<any>,
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
    }
}

function* AppInput({ onRedirect, onCard }: GetProps<'onRedirect', 'onCard'>) {
    yield input(async ({ messageText }) => {
        if (!messageText)
            return

        const card = parseCard(messageText)

        if (card) {
            await onCard(card)
        }
        else if (parseCommand(messageText)) {
            onRedirect(messageText)
        }
        else
            await onRedirect('main?message=bad_card')
    })
}

export function* Settings({
    settings, onUpdateSettings
}: GetProps<'settings', 'onUpdateSettings'>) {
    yield message(`columns: ${settings.columns}`)
    yield radioRow(['1', '2'], (idx, data) =>
        onUpdateSettings({ columns: (idx + 1) as (1 | 2) }),
        String(settings.columns))
}


export function* App({
    user, path, trainer, settings,
    onRedirect, onCard, onUpdateWord, onReplaceWord, onUpdatedTrainer, onAddExample, onDeleteWord, onUpdateSettings
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
        yield AppInput({ onRedirect, onCard })
        yield MainMenu({ user, titleMessage, onRedirect })
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
                yield button('Back', () => onRedirect('/words'))
                yield CardPage({ user, word, query, path: pathname, onReplaceWord, onUpdateWord, onAddExample, onDeleteWord, onRedirect })
            } else {
                yield effect(() => onRedirect('main?message=not_found'))
            }
        }
    }
}

function* CardPageInput({
    word,
    onReplaceWord, onUpdateWord, onAddExample, onDeleteWord, onRedirect
}: GetProps<'onUpdateWord', 'onReplaceWord', 'onAddExample', 'onDeleteWord', 'onRedirect'> & { word: WordEntity }) {
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
                tags: word.tags,
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

function* CardPage({
    user, word, path, query,
    onReplaceWord, onUpdateWord, onAddExample, onDeleteWord, onRedirect
}: GetProps<'user', 'onUpdateWord', 'onReplaceWord', 'onAddExample', 'onDeleteWord', 'onRedirect'> & { word: WordEntity, query?: PathQuery, path: string }) {

    yield CardPageInput({
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
            'Add to trainer',
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

function* Card({ word }: { word: WordEntity }) {
    yield messagePart(`><b> ${word.theword}</b>`)

    if (word.tags.length)
        yield messagePart(word.tags.join(' '))

    if (word.transcription)
        yield messagePart(word.transcription)

    for (const meaning of word.meanings) {
        yield messagePart('')
        yield messagePart(`${descriptionSymbol} ${meaning.description}`)
        for (const example of meaning.examples)
            yield messagePart(`<i>${exampleSymbol} ${example}</i>`)
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

import { sortBy } from 'fp-ts/Array'
import { ord, ordString } from 'fp-ts/Ord'
import { AppSettings, setColumns, updateSettings } from "./store/settings";

export function* WordsList({ words, columns = 1 }: {
    words: WordEntity[]
    columns?: 1 | 2
}) {
    words = [...words]

    const sortByWord = sortBy(
        [ord.contramap(ordString, (w: WordEntity) => w.theword)]
    )
    const sorted = sortByWord(words)

    if (columns == 1) {
        yield message(
            sorted.map(w =>
                `<code>${textColumns([w.theword], [`</code>`], 20).join('')}/w_${w.id}`)
        )
    } else {

        const [left, right] = splitAt(Math.ceil(sorted.length / 2))(sorted)

        for (const [leftString, rightString] of zip(
            left.map(w =>
                `<code>${textColumns([w.theword], [`</code>`], 20).join('')}/w_${w.id}`),
            right.map(w =>
                `<code>${textColumns([w.theword], [`</code>`], 20).join('')}/w_${w.id}`)
        )) {
            yield messagePart(
                `${leftString ?? ''}       ${rightString ?? ''}`
                // `${textColumns([w.theword + '<code> '], [`</code>`]).join('')}/w_${w.id}`
                // `<code>${w.theword}</code> /w_123`
            )
            // yield messagePart(`${w.theword} /w_${w.id}`)
        }
    }

    // yield message(
    //     words.sort((a, b) => a.theword.localeCompare(b.theword)).map(
    //         w => `${w.theword}\t/w_${w.id}`
    //     )
    // )
    // for(const word of user.words) {
    // yield message(`${word.theword}`)
    // }

}
