import Debug from 'debug'
import { Telegraf, Telegram } from 'telegraf'
import { TelegrafContext } from 'telegraf/typings/context'
import { Connection, createConnection } from 'typeorm'
import { Card, Statistics, WordsListMessage } from './bot/components'
import { Trainer, TrainerState } from './bot/components/trainer'
import { Card as ICard } from './bot/interfaces'
import { parseCard } from './bot/parsing'
import { Buttons, ChatUI, OnInput, Root, Row, Types } from './bot/ui/chatui'
import { getRandom, parseCommand } from './bot/utils'
import { UserEntity } from './database/entity/user'
import { WordEntity } from './database/entity/word'
import { async } from 'rxjs'

Debug.enable('awad-bot')
const log = Debug('awad-bot')


function MainMenu(props: {
    user: UserEntity,
    messages: string[],
    onRedirect: (path: string) => Promise<void>
}) {
    const buttons: Row[] = [
        [
            ['My words', 'words'],
            ['Tags', 'tags'],
            ['Statistics', 'stats'],
            ['Random word', 'random']],
        [
            ['Train', 'train'],
            ['Settings', 'settings'],
            ['Minimize', 'main'],
        ]
    ]

    return Buttons([
        'Привет',
        ...props.messages
    ].join('\n'),
        buttons, props.onRedirect)
}

async function renderUI(props: {
    user: UserEntity,
    path: string,
    messages: string[],
    trainer: TrainerState,
    onRedirect: (path: string) => Promise<void>,
    onCard: (c: ICard) => Promise<void>,
    onTrainerUpdated: (trainer: TrainerState) => Promise<void>,
}): Promise<Types.Element[]> {

    const { user, trainer, onRedirect, onTrainerUpdated } = props

    const header = [
        MainMenu(props),
        OnInput(async text => {
            const card = parseCard(text)
            if (card)
                await props.onCard(card)

            else if (parseCommand(text)) {
                await props.onRedirect(text)
            }
        })
    ]

    switch (props.path) {
        case 'words':
            return [
                ...header,
                ...WordsListMessage({ words: props.user.words }),
            ]
        case 'stats':
            return [
                ...header,
                ...Statistics({ user: props.user }),
            ]
        case 'random':
            return [
                ...header,
                ...Card({ word: getRandom(props.user.words) })
            ]
        case 'train':
            return [
                // ...header,
                ...Trainer({ user, onRedirect, onUpdated: onTrainerUpdated, trainer })
            ]
        case 'main':
            return [
                ...header
            ]
        default:
            const path_cmd = parseCommand(props.path)

            if (path_cmd) {
                const [path, id] = path_cmd

                if (path == 'w') {
                    const word = props.user.words.find(w => w.id == id)

                    if (word)
                        return [
                            ...header,
                            ...WordsListMessage({ words: props.user.words }),
                            ...Card({ word })
                        ]
                }
            }
    }

    return [
        ...header
    ]
}

interface ChatState {
    user: UserEntity,
    path: string,
    messages: string[],
    trainer: TrainerState
}

function getRoot(connection: Connection) {
    const root: Root<ChatState> = (state, updateState) => renderUI({
        ...state,
        onRedirect: async (path) => {
            await updateState({ path })
        },
        onCard: async (card) => {
            const words = connection.getRepository(WordEntity)
            const users = connection.getRepository(UserEntity)

            const wordEntity = new WordEntity()

            wordEntity.theword = card.word
            wordEntity.tags = card.tags
            wordEntity.meanings = card.meanings
            wordEntity.transcription = card.transcription
            wordEntity.userId = state.user.id

            await words.save(wordEntity)

            const user = await users.findOne(state.user.id)

            await updateState({ messages: ['Слово добавлено'], user })
        },
        onTrainerUpdated: async (trainer) => {
            await updateState({ trainer })
        }
    })

    return root
}

const initialState = (user: UserEntity) => ({
    user,
    path: 'main',
    messages: [],
    trainer: {
        cards: []
    }
})

const chatsUI: { [chatId: number]: ChatUI<ChatState> } = {}

export const messageHandler =
    (connection: Connection, telegram: Telegram) => async (ctx: TelegrafContext) => {

        const users = connection.getRepository(UserEntity)
        const words = connection.getRepository(WordEntity)

        const chatId = ctx.message?.chat.id
        const messageText = ctx.message?.text

        if (!chatId)
            return

        if (!messageText)
            return

        let user = await users.findOne(chatId)

        if (!user) {
            user = new UserEntity()
            user.id = String(chatId)
            user = await users.save(user)
            log(`User created: ${chatId}`)
        }


        if (!(chatId in chatsUI)) {
            chatsUI[chatId] = new ChatUI<ChatState>(
                telegram, chatId, getRoot(connection), initialState(user)
            )
        }

        let chatUI = chatsUI[chatId];

        await chatUI.handleMessage(ctx)

        // if (ctx.message?.text == '/start') {
        //     await chatUI.update()
        //     // chatUI.userMessages.push(ctx.message)
        // } else {
        //     await channelMessageHandler(connection)(ctx)
        // }

    }

export const actionHandler =
    (connection: Connection, telegram: Telegram) => async (ctx: TelegrafContext) => {
        const users = connection.getRepository(UserEntity)
        const words = connection.getRepository(WordEntity)

        const chatId = ctx.chat?.id

        log(`actionHandler(${chatId})`);

        if (!chatId)
            return

        if (!(chatId in chatsUI)) {
            return
        }

        let chatUI = chatsUI[chatId];

        await chatUI.handleAction(ctx)
    }


async function main() {

    if (!process.env.BOT_TOKEN) {
        console.error('Missing BOT_TOKEN')
        return
    }
    
    const connection = await createConnection()

    const bot = new Telegraf(process.env.BOT_TOKEN)

    bot.on('message', messageHandler(connection, bot.telegram))
    // bot.on('edited_message', messageHandler(connection, bot.telegram))
    bot.action(/.+/, actionHandler(connection, bot.telegram))

    console.log('Starting the bot...')

    await bot.launch()

    console.log('Started...')
}

main()