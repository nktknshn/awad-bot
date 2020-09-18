import Debug from 'debug'
import { Telegram } from 'telegraf'
import { TelegrafContext } from 'telegraf/typings/context'
import { IncomingMessage, Message as TelegramMessage, ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { isArray, isBoolean } from 'util'
import { flattenList, makeKeyboardRows } from './util'
import deq from 'fast-deep-equal'


Debug.enable('awad-bot')
const log = Debug('awad-bot')


export namespace Types {

    export type Element = Message | InputHandler

    export interface Message {
        kind: 'message'
        text: string,
        extra?: ExtraReplyMessage,
        render<S>(chatUI: ChatUI<S>, targetMessage?: TelegramMessage): Promise<TelegramMessage>,
        callbacks: [string, Callback][]
    }

    export interface InputHandler {
        kind: 'input',
        callback: Callback
    }
}

export function Read(props: {
    text: string,
    onInput: Callback
}) {
    return [
        Message(props.text),
        OnInput(props.onInput)
    ]
}

export function OnInput(callback: Callback): Types.InputHandler {
    return {
        kind: 'input',
        callback
    }
}

function constructMessage(
    text: string,
    extra?: ExtraReplyMessage,
    callbacks?: [string, Callback][]
): Types.Message {

    text = text || '<empty>'

    return {
        kind: 'message',
        text,
        extra,
        async render<S>(chatUI: ChatUI<S>, target?: TelegramMessage) {
            if (target) {
                const ret = await chatUI.telegram
                    .editMessageText(
                        chatUI.chatId,
                        target.message_id,
                        undefined,
                        text,
                        extra)

                if (!isBoolean(ret))
                    return ret
            }

            return await chatUI.telegram.sendMessage(
                chatUI.chatId,
                this.text,
                extra)
        },
        callbacks: callbacks ?? []
    }
}

export function Message(
    text: (string | string[]),
    onDelete?: () => void,
    onReply?: () => void,
): Types.Message {
    return constructMessage(isArray(text) ? text.join('\n') : text)
}

export type ButtonElement = string | [string, string]
export type Row = ButtonElement[]

export function Buttons<S>(
    text: string | string[],
    rows: Row[],
    callback: Callback): Types.Message {

    const rowsData = rows.map(row =>
        row.map(v => isArray(v) ? v : [v, v] as [string, string])
    )

    return constructMessage(
        isArray(text) ? text.join('\n') : text,
        makeKeyboardRows(rowsData).extra(),
        flattenList(rowsData).map(([_, data]) => [data, callback])
    )
}

export function SelectionRow(
    row: string[],
    selectedIdx?: number,
    onClick?: () => void
) {
    return row
}

export type Root<S> = (state: S, updateState: ((s: Partial<S>) => Promise<void>)) => Promise<Types.Element[]>

export type Callback = (data: string) => Promise<void | Types.Element | Types.Element[]>

export class ChatUI<S> {
    telegram: Telegram
    chatId: number

    renderedElements: [Types.Message, (TelegramMessage | IncomingMessage)][]
    // userMessages: IncomingMessage[]

    callbacks: [string, Callback][]
    inputHandlers: Types.InputHandler[]

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

        for (const [data, callback] of this.callbacks) {
            if (data == action) {
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
    }

    async update() {
        await this.render(
            await this.root(
                this.state,
                this.updateState.bind(this)
            )
        )
    }

    async render(elements: Types.Element[]) {

        let rendered: [Types.Message, (TelegramMessage | IncomingMessage)][] = []
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

    // async fullChar() {
    //     const chat = await this.telegram.getChat(this.chatId)

    //     // this.telegram.dele
    // }

    async clear(messages: TelegramMessage[]) {
        for (const el of messages) {
            try {
                await this.telegram.deleteMessage(this.chatId, el.message_id)
            } catch (e) {
                console.error(e);
                continue
            }
        }

        // for (const el of this.userMessages) {
        //     try {
        //         await this.telegram.deleteMessage(this.chatId, el.message_id)
        //     } catch (e) {
        //         console.error(e);
        //         continue
        //     }

        // }

        // this.elements = []
        // this.userMessages = []
        // this.callbacks = []
        // this.inputHandlers = []
    }
}