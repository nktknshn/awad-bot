import { createChatHandlerFactory } from "Lib/application"
import { ChatsDispatcher } from "Lib/chatsdispatcher"
import { initLogging, mylog } from "Lib/logging"
import { StackFrame } from "stacktrace-js"
import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import {createApp} from "./bot3/index3"
import { token } from "./telegram-token.json"

async function main() {

    const byfunc = (fname: string) => (fs: StackFrame[]) =>
        fs[0].functionName ? fs[0].functionName?.indexOf(fname) > -1 : false

    const grep = (ss: string) => (s: string, fs: StackFrame[]) => s.indexOf(ss) > -1

    initLogging([
        () => true
        // byfunc('.renderActions'),
        // byfunc('createChatHandlerFactory'),
        // grep('handleMessage'),
        // // grep('handleAction'),
        // grep('QueuedChatHandler'),
        // grep('TRACE'),
        // grep('routeAction'),
        // grep('deleteMessage'),
        // grep('inputHandler'),
        // grep('tree.nextStateTree.state'),
        // grep('getState'),
        // grep('StoreF.apply'),
    ])

    const bot = new Telegraf(token)
    const dispatcher = new ChatsDispatcher(
        createChatHandlerFactory(createApp({}))
    )

    bot.on('message', dispatcher.messageHandler)
    bot.action(/.+/, dispatcher.actionHandler)

    bot.catch((err: any, ctx: TelegrafContext) => {
        console.error(`Ooops, encountered an error for ${ctx.updateType}`, err)
    })

    mylog('Starting the bot...')

    await bot.launch()

    mylog('Started...')
}

main()