import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { PhotoSize } from "telegraf/typings/telegram-types"
import { Application, createChatHandlerFactory, genericRenderFunction } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"
import { connected2, GetSetState } from "./lib/elements"
import { button, file, message, messagePart, photo } from "./lib/elements-constructors"
import { defaultHandler, handlerChain, or, startHandler, withContextOpt } from "./lib/handler"
import { action, casePhoto, caseText, ifTrue, inputHandler, on } from "./lib/input"
import { select } from "./lib/state"
import { AppReqs } from "./lib/types-util"
import { token } from "./telegram-token.json"

type Context = ReturnType<typeof createStore>['store']['state'] & ReturnType<typeof createStore>['dispatcher']

export const casePassword =
    (password: string) => on(caseText, ifTrue(text => text == password))

const App = connected2(
    select(
        ({ onSetVisible, onAddItem, onSetSecondsLeft }: Context) => ({ onSetVisible, onAddItem, onSetSecondsLeft }),
        ({ isVisible, items, secondsLeft }: Context) => ({ isVisible, items, secondsLeft })
    ),
    ({ onSetVisible, isVisible, onAddItem, onSetSecondsLeft, items, secondsLeft }) =>
        function* (
            { password }: { password: string },
            { getState, setState }: GetSetState<{
                stringCandidate?: string,
                photoCandidate?: PhotoSize[]
            }>
        ) {

            yield inputHandler(
                on(casePassword(password), action(() => onSetVisible(true))),
                on(caseText, action(text => setState({ stringCandidate: text }))),
                on(casePhoto, action(photo => setState({ photoCandidate: [photo[0]] })))
            )

            const { stringCandidate, photoCandidate } = getState({})

            if (isVisible) {
                for (const item of items) {
                    if (typeof item === 'string')
                        yield message(item)
                    else
                        for (const p of item)
                            yield photo(p.file_id)
                }
                yield message("Secrets!")
                yield button(`Hide`, () => onSetVisible(false))
                yield button(`More time (${secondsLeft} secs)`, () => onSetSecondsLeft(15))

            }
            else if (stringCandidate) {
                yield message(`Add '${stringCandidate}?'`)
                yield button(`Yes`, async () => {
                    setState({ stringCandidate: undefined })
                    await onAddItem(stringCandidate)
                })
                yield button(`no`, () => setState({ stringCandidate: undefined }))
            }
            else if (photoCandidate) {
                yield message(`Add?`)
                yield button(`Yes`, async () => {
                    setState({ photoCandidate: undefined })
                    await onAddItem(photoCandidate)
                })
                yield button(`no`, () => setState({ photoCandidate: undefined }))

                for (const p of photoCandidate)
                    yield photo(p.file_id)

            }
            else {
                yield message("hi")
            }
        }
)



function createStore() {
    const store: {
        state: {
            isVisible: boolean,
            items: (string | PhotoSize[])[],
            secondsLeft: number,
            timer?: NodeJS.Timeout
        },
        notify: () => Promise<void>
    } = {
        state: {
            isVisible: false,
            items: [],
            secondsLeft: 0
        },
        notify: async () => { }
    }

    const onSetSecondsLeft = async(secondsLeft: number) => {
        store.state = { ...store.state, secondsLeft }
        await store.notify()
    }
    const onSetVisible = async (visible: boolean) => {
        store.state = { ...store.state, isVisible: visible }

        if (visible) {
            let timer = setInterval(() => {
                if(store.state.secondsLeft > 0)
                    onSetSecondsLeft(store.state.secondsLeft - 1)
                else 
                    onSetVisible(false)
            }, 1000)
            
            store.state = { ...store.state, secondsLeft: 15, timer }
        }
        else {
            store.state.timer && clearInterval(store.state.timer)
            store.state = { ...store.state, timer: undefined }
        }

        await store.notify()
    }

    const onAddItem = async (item: string | PhotoSize[]) => {
        store.state = { ...store.state, items: [...store.state.items, item] }
        await store.notify()
    }

    return {
        store,
        dispatcher: {
            onSetVisible,
            onAddItem,
            onSetSecondsLeft
        }
    }
}

function createApp(): Application {

    const { store, dispatcher } = createStore()

    return {
        renderFunc: genericRenderFunction(App, { password: 'abcdef' }, () => ({ ...dispatcher, ...store.state })),
        init: async (ctx, renderer, chat, chatdata) => {
            store.notify = () => {
                return chat.handleEvent(ctx, "updated")
            }
        },
        handleMessage: withContextOpt(
            handlerChain([
                or(startHandler, defaultHandler)
            ]))
    }
}

async function main() {

    const bot = new Telegraf(token)
    const dispatcher = new ChatsDispatcher(
        createChatHandlerFactory(createApp())
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