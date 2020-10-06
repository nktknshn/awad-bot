import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { createConnection } from "typeorm"
import { createChat } from "./bot2/chat"
import { getServices } from "./bot2/services"
import { ChatsHandler } from "./lib/chatshandler"


async function main() {

    if (!process.env.BOT_TOKEN) {
        console.error('Missing BOT_TOKEN')
        return
    }
    const connection = await createConnection()

    const bot = new Telegraf(process.env.BOT_TOKEN)
    const services = getServices(connection)

    const chats = new ChatsHandler(
        createChat(services)
    )

    bot.on('message', chats.messageHandler.bind(chats))
    bot.action(/.+/, chats.actionHandler.bind(chats))

    bot.catch((err: any, ctx: TelegrafContext) => {
        console.log(`Ooops, encountered an error for ${ctx.updateType}`, err)
    })

    console.log('Starting the bot...')

    await bot.launch()

    console.log('Started...')
}

main()