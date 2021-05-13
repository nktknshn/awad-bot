import { getAwadServices } from "bot2/services"
import { levelDatabase, levelTracker } from "bot3/leveltracker"
import { pipe } from "fp-ts/lib/pipeable"
import Telegraf from "telegraf"
import { createConnection } from "typeorm"
import { ca } from './bot7/index7'
import { initLogging, mylog } from "./lib/logging"
import { attachAppToBot } from "./lib/util"
import { token } from "./telegram-token.json"
import * as AP from "Lib/newapp"


async function main() {
    initLogging([
        () => true
    ])

    mylog('Starting...')
    const connection = await createConnection()
    const services = getAwadServices(connection)

    await attachAppToBot(
        new Telegraf(token),
        ca({
            services,
            t: levelTracker(levelDatabase('./mydb_bot7'))
        })
    ).launch()

    mylog('Started...')
}

main()