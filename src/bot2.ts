import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { createConnection } from "typeorm"
import { createAwadApplication } from "./bot2/chathandler"
import { getAwadServices } from "./bot2/services"
import { createChatHandlerFactory } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"

import { token } from "./telegram-token.json"

async function main() {

    const connection = await createConnection()

    const bot = new Telegraf(token)

    const services = getAwadServices(connection)

    const dispatcher = new ChatsDispatcher(
        async (ctx) => {
            const chat = await createChatHandlerFactory(createAwadApplication(services))(ctx)
            if(chat) {
                // chat.
            }
            return chat
        }
    )

    bot.on('message', dispatcher.messageHandler)
    bot.action(/.+/, dispatcher.actionHandler)

    bot.catch((err: any, ctx: TelegrafContext) => {
        mylog(`Ooops, encountered an error for ${ctx.updateType}`, err)
    })

    mylog('Starting the bot...')

    await bot.launch()

    mylog('Started...')
}

main()