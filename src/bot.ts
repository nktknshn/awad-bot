import { Telegraf } from 'telegraf'
import { TelegrafContext } from 'telegraf/typings/context'
import { throws } from 'assert'
import { createConnection, Connection } from 'typeorm'
import { UserEntity } from './database/entity/user'
import { WordEntity } from './database/entity/word'
import Debug from 'debug'
import { parseCard } from './bot/parsing'

Debug.enable('awad-bot')
const log = Debug('awad-bot')

const messageHandler = (connection: Connection) => async (ctx: TelegrafContext) => {
    // parse the message and add the word to the database

    const users = connection.getRepository(UserEntity)
    const words = connection.getRepository(WordEntity)

    if (!ctx.message?.text)
        return

    if (!ctx.message?.from)
        return

    const userid = ctx.message.from.id
    const text = ctx.message.text

    const card = parseCard(text)

    if(!card)
        return

    let user = await users.findOne(userid)

    if (!user) {
        user = new UserEntity()
        user.id = String(userid)
        user = await users.save(user)
        log(`User created: ${userid}`)
    }

    const wordEntity = new WordEntity()

    wordEntity.theword = card.word
    wordEntity.tags = card.tags
    wordEntity.meanings = card.meanings
    wordEntity.transcription = card.transcription
    wordEntity.userId = user.id

    await words.save(wordEntity)

    await ctx.reply(`Word saved`)

}

async function main() {

    if (!process.env.BOT_TOKEN) {
        console.error('Missing BOT_TOKEN')
        return
    }

    const connection = await createConnection()

    const bot = new Telegraf(process.env.BOT_TOKEN)

    bot.on('message', messageHandler(connection))

    console.log('Starting the bot...')

    await bot.launch()

    console.log('Started...')
}

main()