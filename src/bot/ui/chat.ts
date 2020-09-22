import { Telegram } from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import Debug from 'debug'

export type ChatFactory = (ctx: TelegrafContext) => Promise<Chat | undefined>
export type StateFactory<S> = (ctx: TelegrafContext) => Promise<S | undefined>

export interface Chat {
    handleMessage(ctx: TelegrafContext): Promise<unknown>
    handleAction(ctx: TelegrafContext): Promise<unknown>
}


export class ChatsHandler {
    chats: { [chatId: number]: Chat } = {}
    pendingChats: {[chatId: number]: Promise<Chat | undefined>} = {}

    constructor(
        readonly chatFactory: ChatFactory,
        readonly logger: Debug.Debugger = Debug('bot-chat')
    ) {

    }

    async getChat(ctx: TelegrafContext) {
        this.logger(`getChat(${ctx.chat?.id})`)

        const chatId = ctx.chat?.id
        
        if (!chatId)
            return

        if (chatId in this.chats) {
            return this.chats[chatId]
        }

        this.logger(`getChat(${ctx.chat?.id}): creating new chat`)

        if(this.pendingChats[chatId])
            return this.pendingChats[chatId]

        this.pendingChats[chatId] = this.chatFactory(ctx)

        let chat = await this.pendingChats[chatId]

        delete this.pendingChats[chatId]

        if (chat === undefined) {
            this.logger('error creating chat')
            return
        } else {
            this.logger('chat created')
        }

        this.chats[chatId] = chat

        return chat
    }

    async messageHandler(ctx: TelegrafContext) {
        const chatId = ctx.chat?.id
        const messageText = ctx.message?.text
        const username = ctx.chat?.username

        if (!chatId)
            return

        this.logger(`messageHandler(${chatId})[${username}] - ${messageText}`)

        const chat = await this.getChat(ctx)

        if (chat === undefined) {
            this.logger('error creating chat')
            return
        }

        await chat.handleMessage(ctx)

    }

    async actionHandler(ctx: TelegrafContext) {
        const chatId = ctx.chat?.id
        const username = ctx.chat?.username

        if (!chatId)
            return

        this.logger(`actionHandler(${chatId}[${username}])`)

        const chat = await this.getChat(ctx)

        if (chat === undefined) {
            this.logger('error creating chat')
            return
        }

        await chat.handleAction(ctx)
    }

}
