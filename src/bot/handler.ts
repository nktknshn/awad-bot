import { parseCard } from "./parsing"
import { UserEntity } from "../database/entity/user"
import { Connection } from "typeorm"
import { TelegrafContext } from "telegraf/typings/context"
import { WordEntity } from "../database/entity/word"
import Debug from 'debug'


Debug.enable('awad-bot')
const log = Debug('awad-bot')

export const messageHandler = (connection: Connection) => async (ctx: TelegrafContext) => {
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

    if (!card)
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