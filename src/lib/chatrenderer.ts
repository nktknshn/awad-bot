import { TelegrafContext } from "telegraf/typings/context"
import { ExtraReplyMessage, InputFile, InputMediaPhoto, Message, MessageDocument, MessageMedia, MessagePhoto } from "telegraf/typings/telegram-types"
import { ContextOpt } from "./handler";
import { randomAnimal } from './util'

export interface ChatRenderer {
    chatId: number,
    message(text: string,
        extra?: ExtraReplyMessage,
        targetMessage?: Message,
        removeTarget?: boolean): Promise<Message>,
    delete(messageId: number): Promise<boolean>,
    sendFile(f: InputFile): Promise<MessageDocument>,
    sendPhoto(f: InputFile): Promise<MessagePhoto>,
    sendMediaGroup(fs: InputFile[]): Promise<Message[]>,
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
                mylog('removing reply markup');
                await this.delete(targetMessage.message_id)
            }
            else {

                const ret = await ctx.telegram.editMessageText(
                    ctx.chat?.id!,
                    targetMessage.message_id,
                    undefined,
                    text,
                    { ...extra, parse_mode: 'HTML' }
                )

                if (typeof ret !== 'boolean')
                    return ret
            }
        }

        return await ctx.replyWithHTML(text, extra)
    },
    async delete(messageId: number) {
        mylog(`renderer.delete(${messageId})`)
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
    },
    async sendPhoto(f: InputFile) {
        return await ctx.telegram.sendPhoto(ctx.chat?.id!, f)
    },
    async sendMediaGroup(fs: InputFile[]) {
        return await ctx.telegram.sendMediaGroup(ctx.chat?.id!,
            fs.map((_: InputFile): InputMediaPhoto => ({
                media: _,
                type: 'photo'
            })))
    }
})

export type Tracker = {
    addRenderedMessage(chatId: number, messageId: number): Promise<void>
    removeRenderedMessage(chatId: number, messageId: number): Promise<void>
    // getRenderedMessage(chatId: number): Promise<number[]>
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
        },
        async sendPhoto(f: InputFile) {
            const sent = await r.sendPhoto(f)

            if (r.chatId)
                await tracker.addRenderedMessage(r.chatId, sent.message_id!)

            return sent
        },
        async sendMediaGroup(fs: InputFile[]) {
            const sent = await r.sendMediaGroup(fs)

            if (r.chatId)
                for(const m of sent)
                    await tracker.addRenderedMessage(r.chatId, m.message_id!)

            return sent
        }
    })

export async function removeMessages(renderedMessagesIds: number[], renderer: ChatRenderer) {
    for (const messageId of renderedMessagesIds ?? []) {
        try {
            await renderer.delete(messageId)
        } catch (e) {
            mylog(`Error deleting ${messageId}`)
        }
    }

    // user.renderedMessagesIds = []
}

export function getTrackingRenderer(t: Tracker) {
    return {
        renderer: function (ctx: TelegrafContext) {
            return messageTrackingRenderer(
                t,
                createChatRenderer(ctx)
            )
        },
        saveMessageHandler: saveMessageHandler(t)
    }
}
import { Do } from 'fp-ts-contrib/lib/Do'
import * as O from 'fp-ts/lib/Option'
import { ChatHandler2, ChatState } from "./chathandler";
import { send } from "node:process";
import { mylog } from "./logging";


export function saveMessageHandler(registrar: Tracker) {
    return function (
        c: ContextOpt
    ) {
        return Do(O.option)
            .bind('chatId', c.chatId)
            .bind('messageId', c.messageId)
            .return(({ chatId, messageId }) =>
                (ctx: TelegrafContext,
                    renderer: ChatRenderer,
                    chat: ChatHandler2<ChatState>,
                    chatdata: ChatState
                ) => registrar.addRenderedMessage(chatId, messageId)
            )

    }
}
