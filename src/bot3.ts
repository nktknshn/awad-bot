import { readFile } from "fs"
import Telegraf, { BaseScene } from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { createConnection } from "typeorm"
import { createChatHandlerFactory } from "./bot2/chathandler"
import { getAwadServices } from "./bot2/services"
import { ChatsDispatcher } from "./lib/chatsdispatcher"

import { session, Stage } from 'telegraf'

import { token } from "./telegram-token.json"
import { UserEntity } from "./database/entity/user"
import { UserEntityState } from "./bot2/store/user"
import { SceneContextMessageUpdate } from "telegraf/typings/stage"

const { enter, leave } = Stage


interface ContextWithState extends SceneContextMessageUpdate {
    state: {
        username: string,
        user?: UserEntityState,
        error?: string
    },
    session: {
        counter: number
    }
}

const wordsScene = new BaseScene<ContextWithState>('words')

wordsScene.enter(ctx => ctx.reply('wordsScene'))
wordsScene.use((ctx) => ctx.reply('in wordsScene'))

const stage = new Stage<ContextWithState>([wordsScene])

// stage.command('cancel', leave())

stage.register(wordsScene)

async function main() {

    const connection = await createConnection()

    const bot = new Telegraf<ContextWithState>(token)

    const services = getAwadServices(connection)

    bot.use(session({
        ttl: 30
    }))

    bot.use(stage.middleware())

    bot.use(async (ctx, next) => {
        ctx.state.username = ctx.chat?.username ?? 'none'

        if (ctx.chat?.id) {
            const user = await services.getUser(ctx.chat?.id)
            if (user)
                ctx.state.user = user
            else
                ctx.state.error = "Can't load user"
        }
        else
            ctx.state.error = "Missing chat id"

        return next()
    })

    bot.command('words', ctx => ctx.scene.enter('words'))

    bot.on('message', async (ctx, next) => {
        ctx.session.counter ??= 0

        await ctx.reply(`counter = ${ctx.session.counter}`)
        await ctx.reply(`username = ${ctx.state.username}`)

        if (ctx.state.error)
            await ctx.reply(`error = ${ctx.state.username}`)
        else if (ctx.state.user)
            await ctx.reply(`words = ${ctx.state.user.words.map(_ => _.theword)
                .join(', ')}`)

        ctx.session.counter += 1
    })


    bot.catch((err: any, ctx: TelegrafContext) => {
        console.log(`Ooops, encountered an error for ${ctx.updateType}`, err)
    })

    console.log('Starting the bot...')

    await bot.launch()

    console.log('Started...')
}

main()