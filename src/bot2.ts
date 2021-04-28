import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { createConnection } from "typeorm"
import { createAwadApplication } from "./bot2/index"
import { getAwadServices } from "./bot2/services"
import { createChatHandlerFactory } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"
import { initLogging, mylog } from "./lib/logging"
import { attachAppToBot } from "./lib/util"

import { token } from "./telegram-token.json"

async function main() {
    initLogging([
        () => true
    ])

    const connection = await createConnection()
    const services = getAwadServices(connection)
    const bot = attachAppToBot(new Telegraf(token), createAwadApplication(services))

    mylog('Starting...')

    await bot.launch()

    mylog('Started...')
}

main()