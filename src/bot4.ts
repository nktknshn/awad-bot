import { StackFrame } from "stacktrace-js"
import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { ChatState, createChatHandlerFactory, createRenderFunction, defaultRenderFunction, emptyChatState, getApp, getUserMessages } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"
import { connected4 } from "./lib/component"
import { createDraftWithImages } from "./lib/draft"
import { button, message } from "./lib/elements-constructors"
import { getActionHandler, getInputHandler, modifyRenderedElements } from "./lib/handler"
import { initLogging, mylog } from "./lib/logging"
import { token } from "./telegram-token.json";
import { defaultActionToChatAction, extendDefaultReducer, flushMatcher, onAction } from "./trying1"
import * as CA from './lib/chatactions';
import { AppActionsFlatten } from "./lib/types-util"
import { RenderDraft } from "./lib/elements-to-messages"
import { GetSetState } from "./lib/elements"
import { RenderedUserMessage, UserMessageElement } from "./lib/usermessage"
import * as A from 'fp-ts/lib/Array'
import { action, caseText, inputHandler, on } from "./lib/input"
import { append, flush } from "./bot3/util"
import { addErrorLoggingToSchema } from "apollo-server"
import { pipe } from "fp-ts/lib/pipeable"

interface Context {
    userMessages: number[]
}

const App = connected4(
    (s: Context) => s,
    function* App(
        ctx, props, {
            getState, setStateF
        }: GetSetState<{
            isCreatingList: boolean,
            list: string[]
        }>
    ) {

        const { isCreatingList, list, lenses } = getState({ isCreatingList: false, list: [] })

        const addItem = (item: string) => setStateF(lenses.list.modify(append(item)))

        if (isCreatingList) {
            yield message('hello')

            yield inputHandler([
                on(caseText, action(({ messageText }) => addItem(messageText)))
            ])

            for (const m of ctx.userMessages) {
                yield new UserMessageElement(m)
            }

            if (ctx.userMessages.length) {
                yield message("finished?")
                yield button("Yes", () => [
                    setStateF(lenses.isCreatingList.set(false)),
                    flush()
                ])
            }
        }
        else {
            yield message('hello')
            yield button('create a list', () => setStateF(lenses.isCreatingList.set(true)))
        }
    }
)

function createApp() {
    type MyState = {}
    type AppAction = AppActionsFlatten<typeof App>
    type AppChatState = ChatState<MyState, AppAction>

    const getContext = (c: AppChatState) => ({
        userMessages: getUserMessages(c)
    })

    return getApp<MyState, AppAction>({
        renderFunc: defaultRenderFunction(App, {}, getContext),
        actionReducer: extendDefaultReducer(
            onAction(
                flushMatcher(),
                async ({ chatdata }) => {
                    return pipe(
                        chatdata,
                        modifyRenderedElements(_ => [])
                    )
                }
            )),
        handleMessage: CA.fromList([CA.addRenderedUserMessage(), CA.applyInputHandler(), CA.render]),
        handleAction: CA.fromList([CA.applyActionHandler(), CA.replyCallback, CA.render])
    })
}

async function main() {

    const byfunc = (fname: string) => (fs: StackFrame[]) => fs[0].functionName ? fs[0].functionName?.indexOf(fname) > -1 : false

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
        createChatHandlerFactory(createApp())
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