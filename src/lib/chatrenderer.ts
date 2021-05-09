import { Do } from 'fp-ts-contrib/lib/Do';
import * as O from 'fp-ts/lib/Option';
import { TelegrafContext } from "telegraf/typings/context";
import { ExtraReplyMessage, InputFile, InputMediaPhoto, Message, MessageDocument, MessagePhoto } from "telegraf/typings/telegram-types";
import { ChatActionContext } from "./chatactions";
import { OpaqueChatHandler } from "./chathandler";
import { ChatState } from "./application";
import { ContextOpt } from "./inputhandler";
import { mylog } from "./logging";
import { randomAnimal } from './util';
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { tryCatch } from "fp-ts/lib/TaskEither";
import { pipe } from 'fp-ts/lib/pipeable';
import { identity } from 'fp-ts/lib/function';

type Response<T> = TE.TaskEither<ChatRendererError, T>

export interface ChatRendererError {
    description?: string
}

export interface ChatRenderer {
    chatId: number,
    message(text: string,
        extra?: ExtraReplyMessage,
        targetMessage?: Message,
        removeTarget?: boolean): Response<Message>,
    delete(messageId: number): Response<boolean>,
    sendFile(f: InputFile): Response<MessageDocument>,
    sendPhoto(f: InputFile): Response<MessagePhoto>,
    sendMediaGroup(fs: InputFile[]): Response<Message[]>,
}

const isCantRemove = (e: ChatRendererError) => e.description
    && e.description == `Bad Request: message can't be deleted for everyone`

export const mapToChatRendererError = (e: unknown) => e as ChatRendererError

export const createChatRendererE = (ctx: TelegrafContext): ChatRenderer => ({
    chatId: ctx.chat?.id!,
    message(text: string,
        extra?: ExtraReplyMessage,
        targetMessage?: Message,
        removeTarget: boolean = false
    ) {
        return pipe(
            O.fromNullable(targetMessage),
            O.map(message => removeTarget
                ? pipe(
                    this.delete(message.message_id)
                    , TE.map(_ => O.none)
                )
                : pipe(
                    tryCatch(
                        () => ctx.telegram.editMessageText(
                            ctx.chat?.id!, message.message_id, undefined, text,
                            { ...extra, disable_notification: false, parse_mode: 'HTML' }
                        )
                        , mapToChatRendererError)
                    , TE.map(ret => typeof ret !== 'boolean' ? O.some(ret) : O.none)
                ))
            , O.fold(() =>
                tryCatch(
                    () => ctx.replyWithHTML(text, extra)
                    , mapToChatRendererError),
                message => TE.flatten(
                    pipe(
                        message,
                        TE.map(
                            O.fold(() => tryCatch(
                                () => ctx.replyWithHTML(text, extra)
                                , mapToChatRendererError)
                                , m => TE.of(m))
                        ))
                ))
        )
    },
    delete(messageId: number): Response<boolean> {
        mylog(`renderer.delete(${messageId})`)

        return pipe(
            tryCatch(
                () => ctx.deleteMessage(messageId)
                , mapToChatRendererError),
            TE.orElse(e => isCantRemove(e)
                ? tryCatch(
                    () => ctx.telegram.editMessageText(
                        ctx.chat?.id,
                        messageId,
                        undefined,
                        randomAnimal())
                        .then(_ => true)
                    , mapToChatRendererError)
                : TE.of(false)
            )
        )
    },
    sendFile(f: InputFile) {
        return tryCatch(
            () => ctx.telegram.sendDocument(ctx.chat?.id!, f)
            , mapToChatRendererError)
    },
    sendPhoto(f: InputFile) {
        return tryCatch(
            () => ctx.telegram.sendPhoto(ctx.chat?.id!, f)
            , mapToChatRendererError)
    },
    sendMediaGroup(fs: InputFile[]) {
        return tryCatch(
            () => ctx.telegram.sendMediaGroup(ctx.chat?.id!,
                fs.map((_: InputFile): InputMediaPhoto => ({
                    media: _,
                    type: 'photo'
                })))
            , mapToChatRendererError)
    }
})

export type Tracker = {
    trackRenderedMessage(chatId: number, messageId: number): Promise<void>
    untrackRenderedMessage(chatId: number, messageId: number): Promise<void>
    getRenderedMessage(chatId: number): Promise<number[]>
}

export const messageTrackingRendererE: (tracker: Tracker, r: ChatRenderer) => ChatRenderer =
    (tracker, r) => ({
        chatId: r.chatId,
        message(text, extra, targetMessage, removeTarget) {
            return pipe(
                r.message(text, extra, targetMessage, removeTarget),
                TE.chainFirst(
                    sent =>
                        !targetMessage && r.chatId
                            ? tryCatch(
                                () => tracker.trackRenderedMessage(r.chatId, sent.message_id!)
                                , mapToChatRendererError)
                            : TE.of(undefined as void)
                )
            )
        },
        delete(messageId) {
            console.log(`delete: ${messageId}`);

            return pipe(
                tryCatch(
                    () => tracker.untrackRenderedMessage(r.chatId, messageId)
                    , mapToChatRendererError
                )
                , TE.chain(() => r.delete(messageId))
            )
        },
        sendFile(f: InputFile) {
            return pipe(
                r.sendFile(f),
                TE.chainFirst(sent => tryCatch(
                    () => tracker.trackRenderedMessage(r.chatId, sent.message_id!)
                    , mapToChatRendererError))
            )
        },
        sendPhoto(f: InputFile) {
            return pipe(
                r.sendPhoto(f),
                TE.chainFirst(sent => tryCatch(
                    () => tracker.trackRenderedMessage(r.chatId, sent.message_id!)
                    , mapToChatRendererError))
            )
        },
        sendMediaGroup(fs: InputFile[]) {
            return pipe(
                r.sendMediaGroup(fs),
                TE.chainFirst(sent => array.sequence(TE.taskEither)(
                    sent.map(sent => tryCatch(
                        () => tracker.trackRenderedMessage(r.chatId, sent.message_id!)
                        , mapToChatRendererError))
                ))
            )
        }
    })
import { array } from 'fp-ts/lib/Array'

export function removeMessages(renderedMessagesIds: number[], renderer: ChatRenderer)
    : TE.TaskEither<ChatRendererError, boolean[]> {
    return array.sequence(TE.taskEitherSeq)(
        renderedMessagesIds.map(messageId => renderer.delete(messageId))
    )
}

export function getTrackingRendererE(t: Tracker) {
    const cleanChatTask = (chatId: number) => (renderer: ChatRenderer) => {
        return pipe(
            tryCatch(
                () => t.getRenderedMessage(chatId)
                , mapToChatRendererError)
            , TE.chain(
                messages => removeMessages(messages, renderer)
            )
        )
    }

    return {
        renderer: function (ctx: TelegrafContext) {
            return messageTrackingRendererE(t, createChatRendererE(ctx))
        },
        saveToTrackerAction: saveToTracker(t),
        cleanChatTask,
        cleanChatAction: async <R, H, E>(ctx: ChatActionContext<R, H, E>): Promise<ChatState<R, H>> => {

            const res = await cleanChatTask(ctx.tctx.chat?.id!)(ctx.renderer)()
            console.log(res);
            
            return ctx.chatdata
        },
        untrackRendererElementsAction: async <R, H, E>({ chatdata, tctx }: ChatActionContext<R, H, E>)
            : Promise<ChatState<R, H>> => {
            for (const r of chatdata.renderedElements) {
                for (const id of r.outputIds()) {
                    await t.untrackRenderedMessage(tctx.chat?.id!, id)
                }
            }
            return chatdata
        },
        tracker: t
    }
}


export const saveToTracker =
    (tracker: Tracker) =>
    (async <R, H, E>(ctx: ChatActionContext<R, H, E>) => {
        await tracker.trackRenderedMessage(ctx.tctx.chat?.id!, ctx.tctx.message?.message_id!)
        return ctx.chatdata
    })

export function saveMessageHandler<R, H>(registrar: Tracker) {
    return function (
        c: ContextOpt
    ) {
        return Do(O.option)
            .bind('chatId', c.chatId)
            .bind('messageId', c.messageId)
            .return(({ chatId, messageId }) =>
                (ctx: TelegrafContext,
                    renderer: ChatRenderer,
                    chat: OpaqueChatHandler<ChatState<R, H>>,
                    chatdata: ChatState<R, H>
                ) => registrar.trackRenderedMessage(chatId, messageId)
            )

    }
}
