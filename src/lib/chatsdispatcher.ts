import Debug from 'debug'
import { TelegrafContext } from "telegraf/typings/context"
import { ChatHandler2 , ChatState } from './chathandler'
import { mylog } from './logging'

export type ChatHandlerFactory<T extends ChatHandler2<E>, E> = (ctx: TelegrafContext) => Promise<T | undefined>

// export interface ChatHandler {
//     handleMessage(ctx: TelegrafContext): Promise<void>
//     handleAction(ctx: TelegrafContext): Promise<void>
// }

type Dict<V> = { [key: string]: V }
type DictNumber<V> = { [key: number]: V }


export class ChatsDispatcher<T extends ChatHandler2<E>, E> {

    private chats: { [chatId: number]: ChatHandler2<E> } = {}
    private pendingChats: DictNumber<Promise<ChatHandler2<E> | undefined>> = {}

    constructor(
        readonly chatFactory: ChatHandlerFactory<T, E>,
        readonly logger: (s: string) => void = mylog
    ) { }

    async getChat(ctx: TelegrafContext) {
        this.logger(`getChat(${ctx.chat?.id})`)

        const chatId = ctx.chat?.id

        if (!chatId)
            return

        if (chatId in this.chats) {
            return this.chats[chatId]
        }

        this.logger(`getChat(${ctx.chat?.id}): creating new chat`)

        if (this.pendingChats[chatId])
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

    public messageHandler = async (ctx: TelegrafContext) => {
        const chatId = ctx.chat?.id
        const messageId = ctx.message?.message_id
        const messageText = ctx.message?.text
        const username = ctx.chat?.username

        if (!chatId)
            return

        if (ctx.chat?.type != 'private')
            return

        this.logger(`messageHandler(${chatId})[${username}] - ${messageId} - ${messageText}`)

        const chat = await this.getChat(ctx)

        if (chat === undefined) {
            this.logger('error creating chat')
            return
        }

        this.logger(`chatId=${chatId} starting handleMessage for ${messageId}`)
        await chat.handleMessage(ctx)
        this.logger(`chatId=${chatId} finished handleMessage for ${messageId}`)

    }

    public actionHandler = async (ctx: TelegrafContext) => {
        const chatId = ctx.chat?.id
        const username = ctx.chat?.username

        if (!chatId)
            return

        if (ctx.chat?.type != 'private')
            return

        this.logger(`actionHandler(${chatId}[${username}])`)

        const chat = await this.getChat(ctx)

        if (chat === undefined) {
            this.logger('error creating chat')
            return
        }
        this.logger(`chatId=${chatId} starting handleAction`)
        await chat.handleAction(ctx)
        this.logger(`chatId=${chatId} finished handleAction`)

    }

}
