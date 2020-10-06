import { Card } from "../bot/interfaces";
import { CardUpdate, parseCard, parseCardUpdate, parseExample, makeCardText } from "../bot/parsing";
import { parseCommand, range } from "../bot/utils";
import { UserEntity } from "../database/entity/user";
import { WordEntity } from "../database/entity/word";
import { buttonsRow, effect, input, message, messagePart, nextMessage } from "../lib/helpers";
import { Keyboard } from "../lib/types";
import { UI } from "../lib/ui";
import { lastItem, parsePath } from "../lib/util";
import { Services } from "./services";
import { createStore, RootState } from "./store";
import { redirect } from "./store/path";
import { TrainerState, updateTrainer } from "./store/trainer";
import { addWord, saveWord, updateWord, addExample, deleteWord } from "./store/user";
import { Trainer } from "./trainer";

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
}

const messages: Record<string, string> = {
    'word_added': '👌 Word added',
    'bad_card': '❌ Bad card',
    'not_found': '❌ Word wasn\'t found',
    'word_removed': '👌 Word removed',
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
        onDeleteWord: word => store.dispatch(deleteWord(word))
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

export function* App({
    user, path, trainer,
    onRedirect, onCard, onUpdateWord, onReplaceWord, onUpdatedTrainer, onAddExample, onDeleteWord
}: AppProps) {
    const { pathname, query } = parsePath(path)
    const titleMessage = query ? String(query['message']) : undefined

    if (!user) {
        yield message('Loading profile...')
        return
    }

    if (pathname == 'trainer') {
        yield Trainer({ user, trainer, onRedirect, onUpdated: onUpdatedTrainer })
    } else {
        yield AppInput({ onRedirect, onCard })
        yield MainMenu({ user, titleMessage, onRedirect })

        if (pathname == 'words') {
            yield WordsList({ user })
        }
        else if (pathname == 'stats') {
            yield messagePart('Stats')
            yield nextMessage()
            yield messagePart('Yes')
            yield messagePart('Yes2')
        }
        else if (pathname && parseCommand(pathname)) {
            const [path, id] = parseCommand(pathname)!
            if (path == 'w') {
                const word = user.words.find(w => w.id == id)
                if (word) {
                    yield WordsList({ user })
                    yield messagePart('')
                    yield messagePart('Copy the following card, make changes and send it back to edit the card:')
                    yield nextMessage()
                    yield CardPage({ user, word, onReplaceWord, onUpdateWord, onAddExample, onDeleteWord, onRedirect })
                } else {
                    yield effect(() => onRedirect('main?message=not_found'))
                }
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

        if (messageText == 'Delete') {
            await onDeleteWord(word)
                .then(() => onRedirect('words?message=word_removed'))
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
        else {
            const { tags, meanings } = parseCardUpdate(messageText)

            if (tags.length || meanings.length) {
                await onUpdateWord(word, { tags, meanings })
                return true
            } else
                return await next()
        }
    })
}

function* CardPage({
    user, word,
    onReplaceWord, onUpdateWord, onAddExample, onDeleteWord, onRedirect
}: GetProps<'user', 'onUpdateWord', 'onReplaceWord', 'onAddExample', 'onDeleteWord', 'onRedirect'> & { word: WordEntity }) {

    yield CardPageInput({
        word,
        onUpdateWord, onReplaceWord, onAddExample, onDeleteWord, onRedirect
    })

    yield buttonsRow(
        ['Add to trainer', 'Pin', 'Delete'],
        async (idx, data) => {
            data == 'Delete' &&
                await onDeleteWord(word)
                    .then(() => onRedirect('words?message=word_removed'))
        }
    )
    yield message(makeCardText(word))
    // yield new Keyboard('Delete', false)
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
        ['Statistics', 'stats'],
        ['Random word', 'random']],
        (_, path) => onRedirect(path))

    yield buttonsRow(
        [
            ['Train', 'trainer'],
            // ['Settings', 'settings'],
            ['Minimize', 'main'],
        ],
        (_, path) => onRedirect(path)
    )
}

function* WordsList({ user }: {
    user: UserEntity
}) {
    const words = [...user.words]
    yield message(
        words.sort((a, b) => a.theword.localeCompare(b.theword)).map(
            w => `${w.theword}\t/w_${w.id}`
        )
    )
    // for(const word of user.words) {
    // yield message(`${word.theword}`)
    // }

}
