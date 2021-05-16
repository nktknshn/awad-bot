import { pipe } from "fp-ts/lib/pipeable"
import Telegraf from "telegraf"
import { createConnection } from "typeorm"
import { createApp } from './bot8/index8'
import { initLogging, mylog } from "Lib/logging"
import { attachAppToBot } from "Lib/util"
import { token } from "./telegram-token.json"

async function main() {
    initLogging([
        () => true
    ])

    mylog('Starting...')

    await attachAppToBot(
        new Telegraf(token),
        createApp({})
    ).launch()

    mylog('Started...')
}

main()