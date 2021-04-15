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


export const contextOpt = flow(
    (ctx: TelegrafContext) => ({
        chatId: O.fromNullable(ctx.chat?.id),
        messageId: O.fromNullable(ctx.message?.message_id),
        messageText: O.fromNullable(ctx.message?.text)
    }))

export type ContextOpt = ReturnType<typeof contextOpt>

export async function deleteTem(
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState>,
    chatdata: ChatState,
) {
    await deleteAll(renderer, chatdata.renderedElements)
    await chat.handleEvent(ctx, "updated",
        chatdata => ({ ...chatdata, renderedElements: [] })
    )
}


export function startHandler(c: ContextOpt) {
    return pipe(
        c.messageText,
        O.filter(m => m == '/start'),
        O.map(() => deleteTem)
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


export const defaultH =  <R>(messageId: number) => {
    return async function def(
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<ChatState<R>>,
        chatdata: ChatState<R>,
    ) {
        // if (chatdata.inputHandler(ctx))
        //     await renderer.delete(messageId)

        return chatdata.inputHandler(ctx)
        // mylog("defaultH");
        
        // await chat.handleEvent(ctx, "updated")
    }
}

export type FuncF = (
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState>,
    chatdata: ChatState
) => Promise<any>


export const handlerChain = <C>(chain: ((a: C) => O.Option<FuncF>)[]) => {
    return (a: C) =>
        (ctx: TelegrafContext,
            renderer: ChatRenderer,
            chat: ChatHandler2<ChatState>,
            chatdata: ChatState
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

export const or = <C>(a: (a: C) => O.Option<FuncF>, b:  (a: C) => O.Option<FuncF>) => (c: C) =>  pipe(a(c), O.alt(() => b(c)))

export const withContextOpt = <R>(f: (ctxOpt: ContextOpt) => FuncF): FuncF => {

    return async function (ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<ChatState>,
        chatdata: ChatState) {
        return f(contextOpt(ctx))(ctx, renderer, chat, chatdata)

    }
}

export async function defaultHandleAction<R>(ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState<R>>,
    chatdata: ChatState<R>) {
    await chatdata.actionHandler(ctx)
    await chat.handleEvent(ctx, "updated")
}