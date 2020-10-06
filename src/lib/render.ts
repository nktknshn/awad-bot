import { Markup } from "telegraf"
import { TelegrafContext } from "telegraf/typings/context"
import { ExtraReplyMessage, InputFile, Message, MessageDocument, ReplyKeyboardMarkup } from "telegraf/typings/telegram-types"
import { AppType } from "./types"
import { UI } from "./ui"
import { randomAnimal } from './util'


export interface Renderer {
    ctx: TelegrafContext
    message(text: string,
        extra?: ExtraReplyMessage,
        targetMessage?: Message,
        removeTarget?: boolean): Promise<Message>,
    delete(messageId: number): Promise<boolean>,
    file(f: InputFile): Promise<MessageDocument>
}

export const createRenderFunc = <P>(ui: UI, app: AppType<P>) =>
    (props: P) =>
        ui.renderGenerator(
            app(props)
        )


export const createRenderer = (ctx: TelegrafContext): Renderer => ({
    ctx,
    async message(text: string,
        extra?: ExtraReplyMessage,
        targetMessage?: Message,
        removeTarget?: boolean
    ) {
        console.log(`renderer.message(${text}, extra=${extra}, targetMessage=${targetMessage}), removeTarget=${removeTarget}`);

        if (targetMessage) {

            if (removeTarget) {
                console.log('removing reply markup');
                await this.delete(targetMessage.message_id)
            }
            else {

                // if (extra?.reply_markup && 'keyboard' in extra.reply_markup) {
                //     console.log('removing reply markup');

                //     // await ctx.telegram.editMessageText(
                //     //     ctx.chat?.id!,
                //     //     targetMessage.message_id,
                //     //     undefined,
                //     //     targetMessage.text!,
                //     //     Markup.removeKeyboard().extra()
                //     // )
                //     // await ctx.telegram.editMessageReplyMarkup(
                //     //     ctx.chat?.id!,
                //     //     targetMessage.message_id,
                //     //     undefined,
                //     //     JSON.stringify(Markup.removeKeyboard().extra())
                //     const cleaningMessage =
                //         await ctx.reply(text, Markup.removeKeyboard().extra())

                //     // )
                // }
                console.log(JSON.stringify(extra));
                
                const ret = await ctx.telegram.editMessageText(
                    ctx.chat?.id!,
                    targetMessage.message_id,
                    undefined,
                    text,
                    extra
                )

                if (typeof ret !== 'boolean')
                    return ret
            }
        }

        return await ctx.reply(text, extra)
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
    async file(f: InputFile) {
        return await ctx.telegram.sendDocument(ctx.chat?.id!, f)
    }
})

export type Tracker = {
    addRenderedMessage(chatId: number, messageId: number): Promise<void>
    removeRenderedMessage(chatId: number, messageId: number): Promise<void>
}

export const messageTrackingRenderer: (tracker: Tracker, r: Renderer) => Renderer =
    (tracker, r) => ({
        ctx: r.ctx,
        async message(text, extra, targetMessage, removeTarget) {
            const sent = await r.message(text, extra, targetMessage, removeTarget)

            if (!targetMessage && r.ctx.chat?.id)
                await tracker.addRenderedMessage(r.ctx.chat?.id, sent.message_id!)

            return sent
        },
        async delete(messageId) {
            if (r.ctx.chat?.id)
                await tracker.removeRenderedMessage(r.ctx.chat?.id, messageId)

            return await r.delete(messageId)
        },
        async file(f: InputFile) {
            const sent = await r.file(f)

            if (r.ctx.chat?.id)
                await tracker.addRenderedMessage(r.ctx.chat?.id, sent.message_id!)

            return sent
        }
    })