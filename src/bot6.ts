import Telegraf from "telegraf"
import { createApp } from './bot6/index'
import { initLogging, mylog } from "./lib/logging"
import { attachAppToBot } from "./lib/util"
import { token } from "./telegram-token.json"

async function main() {
    initLogging([
        () => true
    ])

    mylog('Starting...')

    await attachAppToBot(
        new Telegraf(token),
        createApp()
    ).launch()

    mylog('Started...')
}

main()