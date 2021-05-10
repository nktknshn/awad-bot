import { getAwadServices } from "bot2/services"
import { levelDatabase, levelTracker } from "bot3/leveltracker"
import Telegraf from "telegraf"
import { createConnection } from "typeorm"
import { createApp } from './bot7/index7'
import { initLogging, mylog } from "./lib/logging"
import { attachAppToBot } from "./lib/util"
import { token } from "./telegram-token.json"

async function main() {
    initLogging([
        () => true
    ])

    mylog('Starting...')
    const connection = await createConnection()
    const services = getAwadServices(connection)

    await attachAppToBot(
        new Telegraf(token),
        createApp(
            services,
            levelTracker(levelDatabase('./mydb_bot7'))
        )
    ).launch()

    mylog('Started...')
}

main()