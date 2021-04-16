import { Do } from 'fp-ts-contrib/lib/Do';
import * as A from 'fp-ts/lib/Array';
import { flow } from "fp-ts/lib/function";
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import * as T from "fp-ts/lib/Task";
import { TelegrafContext } from "telegraf/typings/context";
import { ChatHandler2, ChatState } from "../lib/chathandler";
import { ChatRenderer } from "../lib/chatrenderer";
import { deleteAll } from "../lib/ui";
import { RenderedElement } from './rendered-messages';

export const findRepliedTo = (r: RenderedElement[]) => (repliedTo: number) => r.find(_ => Array.isArray(_.output)
    ? _.output.map(_ => _.message_id).find((_ => _ == repliedTo))
    : _.output.message_id == repliedTo)

export const contextOpt = flow(
    (ctx: TelegrafContext) => ({
        chatId: O.fromNullable(ctx.chat?.id),
        messageId: O.fromNullable(ctx.message?.message_id),
        messageText: O.fromNullable(ctx.message?.text),
        action: O.fromNullable(ctx.match ? ctx.match[0] : undefined),
        repliedTo: O.fromNullable(ctx.callbackQuery?.message?.message_id),
    }))

export type ContextOpt = ReturnType<typeof contextOpt>

export async function deleteTem<R, H>(
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState<R, H>>,
    chatdata: ChatState<R, H>,
) {
    await deleteAll(renderer, chatdata.renderedElements)
    await chat.handleEvent(ctx, "updated",
        chatdata => ({ ...chatdata, renderedElements: [] })
    )
}

export type ChatAction<R, H> = (ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState<R, H>>,
    chatdata: ChatState<R, H>) => Promise<void>

export function startHandler<R, H>(c: ContextOpt) {
    return pipe(
        c.messageText,
        O.filter(m => m == '/start'),
        O.map((): ChatAction<R, H> => deleteTem)
    )
}

export function defaultHandler(c: ContextOpt) {
    return pipe(
        Do(O.option)
            .bind('messageId', c.messageId)
            .return(({ messageId }) => {
                return defaultH(messageId)
            }),
    )
}


export const defaultH = <R>(messageId: number): ChatAction<R, Promise<boolean>> => {
    return async function def(
        ctx, renderer, chat, chatdata
    ) {
        if (!chatdata.inputHandler)
            return
        if (await chatdata.inputHandler(ctx))
            await renderer.delete(messageId)

        console.log("defaultH");

        await chat.handleEvent(ctx, "updated")
    }
}

export type FuncF<R, H> = (
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState<R, H>>,
    chatdata: ChatState<R, H>
) => Promise<any>


export const handlerChain = <C, R, H>(chain: ((a: C) => O.Option<FuncF<R, H>>)[]) => {
    return (a: C) =>
        (ctx: TelegrafContext,
            renderer: ChatRenderer,
            chat: ChatHandler2<ChatState<R, H>>,
            chatdata: ChatState<R, H>
        ) =>
            Promise.all(pipe(
                chain,
                A.map(z => z(a)),
                A.map(
                    O.map(z => z(ctx, renderer, chat, chatdata))
                ),
                A.filter(O.isSome),
                A.map(a => T.of(a.value))
            ))
}

export const or = <C, R, H>(a: (a: C) => O.Option<FuncF<R, H>>, b: (a: C) => O.Option<FuncF<R, H>>) => (c: C) => pipe(a(c), O.alt(() => b(c)))

export const withContextOpt = <R, H>(f: (ctxOpt: ContextOpt) => FuncF<R, H>): FuncF<R, H> => {

    return async function (ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<ChatState<R, H>>,
        chatdata: ChatState<R, H>) {
        return f(contextOpt(ctx))(ctx, renderer, chat, chatdata)

    }
}

export async function defaultHandleAction<R, H>(ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState<R, H>>,
    chatdata: ChatState<R, H>) {

    if (!chatdata.actionHandler)
        return
    await chatdata.actionHandler(ctx)
    await chat.handleEvent(ctx, "updated")
}