import { ChatUI } from "./chatui";
import { IncomingMessage, Message as TelegramMessage, ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { TelegrafContext } from "telegraf/typings/context";

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

export type ButtonElement = string | [string, string]
export type Row = ButtonElement[]

export type Root<S> = (state: S, updateState: ((s: Partial<S>) => Promise<void>)) => Promise<Element[]>

export type Callback = (data: string) => Promise<void | Element | Element[]>
export type RootFactory<S> = (ctx: TelegrafContext) => Promise<Root<S>>
