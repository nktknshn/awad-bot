import { Do } from 'fp-ts-contrib/lib/Do';
import * as A from 'fp-ts/lib/Array';
import { flow } from "fp-ts/lib/function";
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import * as T from "fp-ts/lib/Task";
import { TelegrafContext } from "telegraf/typings/context";
import { Application, ChatHandler2, ChatState } from "../lib/chathandler";
import { ChatRenderer } from "../lib/chatrenderer";
import { deleteAll } from "../lib/ui";
import { parseFromContext } from './bot-util';
import { InputHandler } from './draft';
import { LocalStateAction, RenderedElementsAction } from './elements';
import { RenderDraft } from './elements-to-messages';
import { InputHandlerF } from './handlerF';
import { mylog } from './logging';
import { BotMessage, RenderedElement } from './rendered-messages';
import { StoreAction, StoreF } from './store2';

export const findRepliedTo = (r: RenderedElement[]) => (repliedTo: number) =>
    r.filter((_): _ is BotMessage => _.kind === 'BotMessage').find(_ => Array.isArray(_.output)
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


export const byMessageId = <R, H, T, E, C extends ChatState<R, H>>(dh: ((messageId: number) => ChatAction<R, H, T, E, C>)) => (c: ContextOpt) => {
    return pipe(
        Do(O.option)
            .bind('messageId', c.messageId)
            .return(({ messageId }) => {
                return dh(messageId)
            }),
    )
}

export async function clearChat<R, H, E, C extends ChatState<R, H>>(
    app: Application<C, H, E>,
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<E>,
    chatdata: C
): Promise<C> {
    await deleteAll(renderer, chatdata.renderedElements)
    return { ...chatdata, renderedElements: [] }
}

export type ChatAction<R, H, T, E, C extends ChatState<R, H>> = (
    app: Application<C, H, E>,
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<E>,
    chatdata: C
) => Promise<T>

export function startHandler<R, H, E, C extends ChatState<R, H>>(c: ContextOpt):
    O.Option<ChatAction<R, H, C, E, C>> {
    return pipe(
        c.messageText,
        O.filter(m => m == '/start'),
        O.map((): ChatAction<R, H, C, E, C> => clearChat)
    )
}

// export function defaultHandler(c: ContextOpt) {
//     return pipe(
//         Do(O.option)
//             .bind('messageId', c.messageId)
//             .return(({ messageId }) => {
//                 return defaultH(messageId)
//             }),
//     )
// }


// export const defaultH = <R>(messageId: number): ChatAction<R, Promise<boolean>, void> => {
//     return async function def(
//         app, ctx, renderer, chat, chatdata
//     ) {
//         if (!chatdata.inputHandler)
//             return
//         if (await chatdata.inputHandler(ctx))
//             await renderer.delete(messageId)

//         console.log("defaultH");

//         await chat.handleEvent("updated")
//     }
// }

export type FuncF<R, H, E> = (
    app: Application<ChatState<R, H>, H, E>,
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<E>,
    chatdata: ChatState<R, H>
) => Promise<ChatState<R, H>>


export const handlerChain = <C, R, H, E>(chain: ((a: C) => O.Option<FuncF<R, H, E>>)[]) => {
    return (a: C) =>
        async (
            app: Application<ChatState<R, H>, H, E>,
            ctx: TelegrafContext,
            renderer: ChatRenderer,
            chat: ChatHandler2<E>,
            chatdata: ChatState<R, H>
        ) =>
            await Promise.all(pipe(
                chain,
                A.map(z => z(a)),
                A.map(
                    O.map(z => z(app, ctx, renderer, chat, chatdata))
                ),
                A.filter(O.isSome),
                A.map(a => a.value)
            ))
}

export const or = <C, R, H, E>(a: (a: C) => O.Option<FuncF<R, H, E>>, b: (a: C) => O.Option<FuncF<R, H, E>>) => (c: C) => pipe(a(c), O.alt(() => b(c)))

export const withContextOpt = <R, H, E>(f: (ctxOpt: ContextOpt) => FuncF<R, H, E>): FuncF<R, H, E> => {

    return async function (
        app: Application<ChatState<R, H>, H, E>,
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<E>,
        chatdata: ChatState<R, H>) {
        return await f(contextOpt(ctx))(app, ctx, renderer, chat, chatdata)

    }
}

export async function defaultHandleAction<R, H, E>(
    app: Application<R, H, E>,
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<E>,
    chatdata: ChatState<R, H>) {

    if (!chatdata.actionHandler)
        return
    await chatdata.actionHandler(ctx)
    // await chat.handleEvent("updated")
}

export function applyRenderedElementsAction(a: RenderedElementsAction) {
    return function <R, H, C extends ChatState<R, H>>(cs: C): C {
        return {
            ...cs,
            renderedElements: a.f(cs.renderedElements)
        }
    }
}


export function applyTreeAction(a: LocalStateAction) {
    return function <R, H, C extends ChatState<R, H>>(cs: C): C {
        return {
            ...cs,
            treeState: a.f(cs.treeState)
        }
    }
}

export function applyChatStateAction<R, H, C extends ChatState<R, H>>(a: (s: C) => C) {
    return function (cs: C): C {
        return a(cs)
    }
}

export function applyStoreAction<S>
    (a: StoreAction<S, S>) {
    return function <C extends ChatState<A, B>, A extends { store: StoreF<S> }, B>(cs: C) {
        return {
            ...cs,
            store: cs.store.apply(a.f)
        }
    }
}

export const inputHandlerFHandler = <A>(h: InputHandler<A>) => (ctx: TelegrafContext): A | undefined => {
    const d = parseFromContext(ctx)
    mylog(`TRACE ${ctx.message?.message_id}`)
    return h.element.callback(d, () => { return undefined })
}

export function getInputHandler<Rdr extends RenderDraft<R>, R>(d: Rdr): ((ctx: TelegrafContext) => R | undefined) {
    return ctx => chainInputHandlers(
        d.inputHandlers.reverse().map(_ => _.element.callback),
        parseFromContext(ctx)
    )
}

export const getActionHandler = <A>(rs: RenderedElement[]) => {
    return function (ctx: TelegrafContext): A | undefined {
        const { action, repliedTo } = contextOpt(ctx)
        const p = pipe(
            repliedTo
            , O.map(findRepliedTo(rs))
            , O.chain(O.fromNullable)
            , O.filter((callbackTo): callbackTo is BotMessage => callbackTo.kind === 'BotMessage')
            , O.chain(callbackTo => pipe(action, O.map(action => ({ action, callbackTo }))))
            , O.chainNullableK(({ callbackTo, action }) => callbackTo.input.callback2<A>(action))
            // , O.map(applyStoreAction)
        )

        if (O.isSome(p)) {
            return p.value
        }
    }
}

export const chainInputHandlers = <D, R>
    (hs: ((d: D, n: () => R | undefined) => R | undefined)[], d: D): R | undefined =>
    hs && hs.length
        ? hs[0](d, () => chainInputHandlers(hs.slice(1), d))
        : undefined

