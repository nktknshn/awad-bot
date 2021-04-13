import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { PhotoSize } from "telegraf/typings/telegram-types"
import { Application, createChatHandlerFactory, genericRenderFunction } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"
import { connected2, GetSetState } from "./lib/elements"
import { button, effect, message, photo } from "./lib/elements-constructors"
import { defaultHandler, handlerChain, or, startHandler, withContextOpt } from "./lib/handler"
import { action, casePhoto, caseText, ifTrue, inputHandler, on } from "./lib/input"
import { token } from "./telegram-token.json"

type Store<S> = {
    state: S,
    notify: () => Promise<void>
}

function createStore<S>(state: S) {
    const store: Store<S> = {
        state,
        notify: async () => { console.log("set notify function") }
    }
    const notify = () => store.notify()
    const getState = () => store.state
    const update = (f: (s: S) => S) => {
        store.state = f(store.state)
    }
    const updateC = (u: Partial<S>) => update(s => ({ ...s, ...u }))

    return {
        store, notify, getState, update, updateC
    }
}

type Context = ReturnType<typeof createBotStore>['store']['state'] & {
    dispatcher: ReturnType<typeof createBotStore>['dispatcher']
}

export const casePassword =
    (password: string) => on(caseText, ifTrue(text => text == password))

const App = connected2(
    (ctx: Context) => ctx,
    ({
        isVisible, items, secondsLeft,
        dispatcher: { onSetVisible, onAddItem, onSetSecondsLeft, onDeleteItem }
    }) =>
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
                    if (typeof item === 'string') {
                        yield message(item)
                        yield button('Delete', async () => { onDeleteItem(item) })
                    }
                    else
                        for (const p of item) {
                            yield photo(p.file_id)
                            yield message("Photo")
                            yield button('Delete', async () => { onDeleteItem(item) })
                        }
                }
                yield message("Secrets!")
                yield button(`Hide`, () => onSetVisible(false))
                yield button(`More time (${secondsLeft} secs)`, () => onSetSecondsLeft(secondsLeft + 30))
            }

            if (stringCandidate) {
                if (!isVisible) {
                    yield message(`Add '${stringCandidate}?'`)
                    yield button(`Yes`, async () => {
                        await onAddItem(stringCandidate)
                    })
                    yield button(`No`, () => setState({ stringCandidate: undefined }))
                }
                else {
                    yield effect(() => onAddItem(stringCandidate))
                }
                setState({ stringCandidate: undefined })

            }
            else if (photoCandidate) {
                if (!isVisible) {

                    yield message(`Add?`)
                    yield button(`Yes`, async () => {
                        await onAddItem(photoCandidate)
                    })
                    yield button(`No`, () => setState({ photoCandidate: undefined }))

                    for (const p of photoCandidate)
                        yield photo(p.file_id)

                }
                else {
                    yield effect(() => onAddItem(photoCandidate))
                }
                setState({ photoCandidate: undefined })
            }
            else if (!isVisible) {
                yield message("hi")
            }
        }
)


function createBotStore() {
    type State = {
        isVisible: boolean,
        items: (string | PhotoSize[])[],
        secondsLeft: number,
        timer: NodeJS.Timeout | undefined
    }

    const { store, notify, updateC, getState } = createStore<State>({
        isVisible: false,
        items: [],
        secondsLeft: 0,
        timer: undefined
    })

    const onSetSecondsLeft = async (secondsLeft: number) => {
        updateC({ secondsLeft })
        await notify()
    }

    const updateSeconds = () => {
        const { secondsLeft } = getState()
        if (secondsLeft > 0)
            onSetSecondsLeft(secondsLeft - 1)
        else
            onSetVisible(false)
    }

    const onSetVisible = async (isVisible: boolean) => {
        updateC({ isVisible })

        if (isVisible) {
            updateC({
                secondsLeft: 15,
                timer: setInterval(updateSeconds, 1000)
            })
        }
        else {
            const { timer } = getState()
            timer && clearInterval(timer)
            updateC({ timer: undefined })
        }

        await notify()
    }

    const onAddItem = async (item: string | PhotoSize[]) => {
        updateC({ items: [...getState().items, item] })
        await notify()
    }

    const onDeleteItem = async (item: string | PhotoSize[]) => {
        updateC({ items: getState().items.filter(_ => _ != item) })
        await notify()
    }

    return {
        store,
        dispatcher: {
            onSetVisible,
            onAddItem,
            onSetSecondsLeft,
            onDeleteItem
        }
    }
}

function createApp(): Application {

    const { store, dispatcher } = createBotStore()

    return {
        renderFunc: genericRenderFunction(
            App, { password: 'Abcdef' },
            () => ({ dispatcher, ...store.state })
        ),

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