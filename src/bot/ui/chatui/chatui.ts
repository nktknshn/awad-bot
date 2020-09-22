import Debug from 'debug'
import { Telegram } from 'telegraf'
import { TelegrafContext } from 'telegraf/typings/context'
import { IncomingMessage, Message as TelegramMessage, ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { isArray, isBoolean } from 'util'
import { flattenList, makeKeyboardRows } from '../util'
import deq from 'fast-deep-equal'
import {Callback, Root, InputHandler, ButtonElement, Element, Message, RootFactory} from './types'
import { StateFactory } from '../chat'

Debug.enable('awad-bot')
const log = Debug('awad-bot')

export function createChatFactory<S>(
    stateFactory: StateFactory<S>,
    rootFactory: RootFactory<S>,
) {
    return async function (ctx: TelegrafContext) {
        const chatId = ctx.chat?.id

        if (!chatId) {
            return
        }

        const state = await stateFactory(ctx)
        const root = await rootFactory(ctx)

        if (state === undefined)
            return

        const chat = new ChatUI<S>(ctx.telegram, chatId, root, state)

        return chat
    }
}


export class ChatUI<S> {
    telegram: Telegram
    chatId: number

    renderedElements: [Message, (TelegramMessage | IncomingMessage)][]
    // userMessages: IncomingMessage[]

    callbacks: [string, Callback][]
    inputHandlers: InputHandler[]

    state: S
    root: Root<S>

    constructor(
        telegram: Telegram,
        chatId: number,
        root: Root<S>,
        state: S
    ) {
        this.renderedElements = []
        // this.userMessages = []
        this.callbacks = []
        this.inputHandlers = []

        this.telegram = telegram
        this.chatId = chatId
        this.state = state
        this.root = root
    }

    async updateState(state: Partial<S>) {
        this.state = { ...this.state, ...state }
        await this.update()
    }

    async handleMessage(ctx: TelegrafContext) {
        // this.elements.push(ctx.message!)

        if (this.inputHandlers.length) {
            await this.inputHandlers[this.inputHandlers.length - 1]
                .callback(ctx.message!.text!)
        }

        // for (const h of this.inputHandlers) {
        //     await h.callback(ctx.message!.text!)
        // }

        try {
            await this.telegram.deleteMessage(this.chatId, ctx.message?.message_id!)
        } catch (e) {
            console.error(e)
        }

        await this.update()
    }

    async handleAction(ctx: TelegrafContext) {
        const action = ctx.match![0]

        log(`ChatUI.handleAction: ${action}`)

        if (!this.renderedElements.length) {
            await this.update()
        }
        let processed = false
        for (const [data, callback] of this.callbacks) {
            if (data == action) {
                processed = true
                const elements = await callback(action)

                if (isArray(elements)) {
                    for (const el of elements) {
                        if (el.kind === 'message') {
                            this.renderedElements.push([el, await el.render(this)])
                            this.callbacks = [...this.callbacks, ...el.callbacks]
                        } else {
                            this.inputHandlers.push(el)
                        }
                    }
                }

                try {
                    await ctx.answerCbQuery()
                } catch(e) {
                    log(e)
                }
            }
        }

        if(!processed)
            await ctx.deleteMessage(ctx.callbackQuery?.message?.message_id)
    }

    async update() {
        await this.render(
            await this.root(
                this.state,
                this.updateState.bind(this)
            )
        )
    }

    async render(elements: Element[]) {

        let rendered: [Message, (TelegramMessage | IncomingMessage)][] = []
        this.callbacks = []
        this.inputHandlers = []

        for (const el of elements) {
            if (el.kind === 'message') {

                const updatable = this.renderedElements.shift()

                if (updatable) {
                    const [renderedElement, renderedElementMessage] = updatable
                    if (renderedElement.text == el.text
                        && deq(renderedElement.extra, el.extra)
                    ) {
                        rendered.push(updatable)
                    } else
                        rendered.push([
                            el,
                            await el.render(this, renderedElementMessage)
                        ])
                } else {
                    rendered.push([el, await el.render(this)])
                }

                this.callbacks = [...this.callbacks, ...el.callbacks]
            } else if (el.kind === 'input') {
                this.inputHandlers.push(el)
            }
        }

        this.clear(this.renderedElements.map(([_, b]) => b))
        this.renderedElements = rendered

    }

    async clear(messages: TelegramMessage[]) {
        for (const el of messages) {
            try {
                await this.telegram.deleteMessage(this.chatId, el.message_id)
            } catch (e) {
                console.error(e);
                continue
            }
        }
    }
}