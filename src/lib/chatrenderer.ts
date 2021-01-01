import { TelegrafContext } from "telegraf/typings/context"
import { ExtraReplyMessage, InputFile, Message, MessageDocument } from "telegraf/typings/telegram-types"
import { randomAnimal } from './util'

export interface ChatRenderer {
    // ctx: TelegrafContext
    chatId: number,
    message(text: string,
        extra?: ExtraReplyMessage,
        targetMessage?: Message,
        removeTarget?: boolean): Promise<Message>,
    delete(messageId: number): Promise<boolean>,
    sendFile(f: InputFile): Promise<MessageDocument>
}

export const createChatRenderer = (ctx: TelegrafContext): ChatRenderer => ({
    chatId: ctx.chat?.id!,
    async message(text: string,
        extra?: ExtraReplyMessage,
        targetMessage?: Message,
        removeTarget?: boolean
    ) {
        if (targetMessage) {

            if (removeTarget) {
                console.log('removing reply markup');
                await this.delete(targetMessage.message_id)
            }
            else {
                const ret = await ctx.telegram.editMessageText(
                    ctx.chat?.id!,
                    targetMessage.message_id,
                    undefined,
                    text,
                    {...extra, parse_mode: 'HTML'}
                )

                if (typeof ret !== 'boolean')
                    return ret
            }
        }

        return await ctx.replyWithHTML(text, extra)
    },
    async delete(messageId: number) {
        console.log(`renderer.delete(${messageId})`)
        try {
            return await ctx.deleteMessage(messageId)
        } catch (e) {
            console.error(`error removing ${messageId}`)
            // Bad Request: message can't be deleted for everyone
            if (e.description
                && e.description == `Bad Request: message can't be deleted for everyone`) {
                console.error(`Bad Request: message can't be deleted for everyone`)
                await ctx.telegram.editMessageText(
                    ctx.chat?.id,
                    messageId,
                    undefined,
                    randomAnimal()
                )

                return true

            }
            return false
        }
    },
    async sendFile(f: InputFile) {
        return await ctx.telegram.sendDocument(ctx.chat?.id!, f)
    }
})

export type Tracker = {
    addRenderedMessage(chatId: number, messageId: number): Promise<void>
    removeRenderedMessage(chatId: number, messageId: number): Promise<void>
}

export const messageTrackingRenderer: (tracker: Tracker, r: ChatRenderer) => ChatRenderer =
    (tracker, r) => ({
        chatId: r.chatId,
        async message(text, extra, targetMessage, removeTarget) {
            const sent = await r.message(text, extra, targetMessage, removeTarget)

            if (!targetMessage && r.chatId)
                await tracker.addRenderedMessage(r.chatId, sent.message_id!)

            return sent
        },
        async delete(messageId) {
            if (r.chatId)
                await tracker.removeRenderedMessage(r.chatId, messageId)

            return await r.delete(messageId)
        },
        async sendFile(f: InputFile) {
            const sent = await r.sendFile(f)

            if (r.chatId)
                await tracker.addRenderedMessage(r.chatId, sent.message_id!)

            return sent
        }
    })