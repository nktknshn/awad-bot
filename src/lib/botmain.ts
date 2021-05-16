import Telegraf from "telegraf"
import { initLogging, mylog } from "Lib/logging"
import { attachAppToBot } from "Lib/util"
import { token as awadtoken } from "../telegram-token.json"
import { createLevelTracker } from "bot3/leveltracker"
import { Application } from "./application"

async function runbot<R, H, E>(
    { token = awadtoken, app }:
        { token?: string, app: Application<R, H, E> }) {

    initLogging([
        () => true
    ])

    mylog('Starting...')

    await attachAppToBot(
        new Telegraf(token),
        app
    ).launch()

    mylog('Started...')
}

export { createLevelTracker, runbot }