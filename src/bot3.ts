import * as A from 'fp-ts/lib/Array'
import { Separated } from "fp-ts/lib/Compactable"
import { Predicate, Refinement } from "fp-ts/lib/function"
import { pipe } from "fp-ts/lib/pipeable"
import { StackFrame } from 'stacktrace-js'
import Telegraf from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { PhotoSize } from "telegraf/typings/telegram-types"
import { mediaGroup, PhotoGroupElement, photos } from './bot3/mediagroup'
import { createChatHandlerFactory, emptyChatState, createRenderFunction, getApp } from "./lib/chathandler"
import { ChatsDispatcher } from "./lib/chatsdispatcher"
import { connected4 } from "./lib/component"
import { BasicElement, GetSetState } from "./lib/elements"
import { button, effect, message } from "./lib/elements-constructors"
import { elementsToMessagesAndHandlers, emptyDraft, RenderDraft } from "./lib/elements-to-messages"
import { handlerChain, or, startHandler, withContextOpt } from "./lib/inputhandler"
import { action, casePhoto, caseText, ifTrue, inputHandler, on } from "./lib/input"
import { initLogging, mylog } from './lib/logging'
import { createStore } from "./lib/storeF"
import { draftToInputHandler } from './lib/ui'
import { token } from "./telegram-token.json"

type Item = string | PhotoSize

type Context = ReturnType<typeof createBotStore>['store']['state'] & {
    dispatcher: ReturnType<typeof createBotStore>['dispatcher']
}


export const casePassword =
    (password: string) => on(caseText, ifTrue(text => text == password))


const VisibleSecrets = connected4(
    (ctx: Context) => ctx,
    function* (
        { items, secondsLeft, dispatcher: { onDeleteItem, onSetVisible, onSetSecondsLeft } }
    ) {

        const strings = pipe(
            items,
            A.partition((_): _ is string => typeof _ === 'string'),
            ({ right }) => right
        )

        const phots = pipe(
            items,
            A.partition((_): _ is PhotoSize => typeof _ !== 'string'),
            ({ right }) => right
        )

        if (phots.length > 0)
            yield photos(phots.map(_ => _.file_id))

        for (const item of strings) {
            yield message(item)
            yield button('Delete', async () => { onDeleteItem(item) })
        }

        yield message("Secrets!")
        yield button(`Hide`, () => onSetVisible(false))
        yield button([`More time (${secondsLeft} secs)`, 'more'], () => {
            mylog(`TRACE More time clicked ${secondsLeft} -> onSetSecondsLeft(${secondsLeft + 30})`)
            return onSetSecondsLeft(secondsLeft + 30)
        })
    }
)


const App = connected4(
    (ctx: Context) => ctx,
    function* (
        { isVisible, dispatcher: { onSetVisible, onAddItem } },
        { password }: { password: string },
        { getState, setState }: GetSetState<{
            stringCandidate?: string,
            photoCandidates?: PhotoSize[]
        }>
    ) {

        yield inputHandler(
            on(casePassword(password), action(() => onSetVisible(true))),
            on(caseText, action(text => setState({ stringCandidate: text }))),
            on(casePhoto, action(photo => {

                const { photoCandidates } = getState({})

                mylog({ photo });
                mylog({ photoCandidates });

                return setState({ photoCandidates: [...photoCandidates ?? [], photo[0]] })
            }))
        )

        const { stringCandidate, photoCandidates } = getState({})

        if (isVisible) {
            yield VisibleSecrets({})
        }

        if (stringCandidate) {
            const addItem = () => onAddItem(stringCandidate)
                .then(() => setState({ stringCandidate: undefined }))

            const rejectItem = () => setState({ stringCandidate: undefined })

            if (!isVisible) {
                yield message(`Add '${stringCandidate}?'`)
                yield button(`Yes`, addItem)
                yield button(`No`, rejectItem)
            }
            else {
                yield effect(addItem)
            }
        }
        else if (photoCandidates) {

            const addItem = () => onAddItem(photoCandidates)
                .then(() => setState({ photoCandidates: undefined }))

            const rejectItem = () => setState({ photoCandidates: undefined })

            if (!isVisible) {
                yield message(`Add?`)
                yield button(`Yes`, addItem)
                yield button(`No`, rejectItem)

                if (photoCandidates.length)
                    yield photos(photoCandidates.map(_ => _.file_id))
            }
            else {
                yield effect(addItem)
            }
        }
        else if (!isVisible) {
            yield message("hi")
        }
    }
)


function createDraftWithImages(
    elements: (BasicElement | PhotoGroupElement)[]
): RenderDraft {
    const draft = emptyDraft()

    function handle(compel: BasicElement | PhotoGroupElement) {
        if (compel.kind === 'PhotoGroupElement') {
            mediaGroup.appendDraft(draft, compel)
        }
        else {
            elementsToMessagesAndHandlers(compel, draft)
        }
    }

    for (const compel of elements) {
        handle(compel)
    }

    return draft
}

function createApp() {

    const chatState = () => {
        return {
            ...emptyChatState<{}, Promise<boolean>>(),
            ...createBotStore()
        }
    }

    return getApp({
        chatDataFactory: chatState,
        renderFunc: createRenderFunction(
            App, { password: 'a' },
            d => ({ dispatcher: d.dispatcher, ...d.store.state }),
            createDraftWithImages,
            draftToInputHandler
        ),
        init: async (ctx, renderer, chat, chatdata) => {
            chatdata.store.subscribe(() => chat.handleEvent(ctx, "updated"))
        },
        handleMessage: withContextOpt(
            handlerChain([
                or(startHandler, defaultHandler)
            ]))
    })
}

type State = {
    isVisible: boolean,
    items: (string | PhotoSize)[],
    secondsLeft: number,
    timer: NodeJS.Timeout | undefined
}

function createBotStore() {

    const { store, notify, updateC, getState } = createStore<State>({
        isVisible: false,
        items: [],
        secondsLeft: 0,
        timer: undefined
    })

    const onSetSecondsLeft = async (secondsLeft: number) => {
        mylog(`onSetSecondsLeft(${secondsLeft})`)
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
        updateC({ items: [...getState().items, ...Array.isArray(item) ? item : [item]] })
        await notify()
    }

    const onDeleteItem = async (item: string | PhotoSize) => {
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

const byfunc = (fname: string) => (fs: StackFrame[]) => fs[0].functionName ? fs[0].functionName?.indexOf(fname) > -1 : false

const grep = (ss: string) => (s: string, fs: StackFrame[]) => s.indexOf(ss) > -1

async function main() {
    initLogging([
        // byfunc('.renderActions'),
        // byfunc('createChatHandlerFactory'),
        // grep('handleMessage'),
        // grep('handleAction'),
        // grep('QueuedChatHandler'),
        // grep('onSetSecondsLeft'),
        grep('TRACE'),
        // grep('queue'),
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