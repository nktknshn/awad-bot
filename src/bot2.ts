import { readFile } from "fs"
import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { createConnection } from "typeorm"
import { createChatHandlerFactory } from "./bot2/chathandler"
import { getAwadServices } from "./bot2/services"
import { ChatsDispatcher } from "./lib/chatsdispatcher"

import { token } from "./telegram-token.json"

async function main() {

    const connection = await createConnection()

    const bot = new Telegraf(token)

    const services = getAwadServices(connection)

    const dispatcher = new ChatsDispatcher(
        createChatHandlerFactory(services)
    )

    bot.on('message', dispatcher.messageHandler)
    bot.action(/.+/, dispatcher.actionHandler)

    bot.catch((err: any, ctx: TelegrafContext) => {
        console.log(`Ooops, encountered an error for ${ctx.updateType}`, err)
    })

    console.log('Starting the bot...')

    await bot.launch()

    console.log('Started...')
}

main()