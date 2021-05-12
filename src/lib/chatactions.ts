import * as F from 'fp-ts/lib/function';
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import { TelegrafContext } from 'telegraf/typings/context';
import { Application, ChatState } from "./application";
import * as CA from './chatactions';
import { OpaqueChatHandler } from './chathandler';
import { ChatRenderer, ChatRendererError, mapToChatRendererError } from './chatrenderer';
import { RenderedElementsAction } from './elements';
import { contextOpt, modifyRenderedElements } from './inputhandler';
import { mylog } from './logging';
import { addRenderedUserMessage as _addRenderedUserMessage, createRendered as createRenderedMessage } from './usermessage';
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";

import * as E from "fp-ts/lib/Either";
import { FlushState } from './components/actions/flush';
import { BasicAppEvent } from './types-util';

export async function render<R, H, E>(
    ctx: ChatActionContext<R, H, E>
): Promise<ChatState<R, H>> {
    return ctx.app.renderFunc(ctx.chatdata).renderFunction(ctx.chatdata.renderer)
}

export async function applyEffects<R, H, E>(
    ctx: ChatActionContext<R, H, E>
): Promise<ChatState<R, H>> {

    const r = ctx.app.renderFunc(ctx.chatdata)

    mylog(`Applying Effects: ${r.effects}`)

    const cd = await sequence<R, H, E>(
        ctx.app.actionReducer(r.effects.map(_ => _.element.callback()))
    )({ ...ctx, chatdata: r.chatdata })

    return cd
}

export function scheduleEvent
    <R extends FlushState, H, E>
    (timeout: number, ev: E): AppChatAction<R, H, E> {
    {
        return async function
            ({ chatdata, queue: chat, tctx }) {

            chatdata.deferredRenderTimer &&
                clearTimeout(chatdata.deferredRenderTimer as NodeJS.Timeout)

            return pipe(
                chatdata,
                c => ({
                    ...c,
                    deferredRenderTimer: setTimeout(
                        () => chat.handleEvent(tctx)(ev),
                        timeout
                    )
                })
            )
        }
    }
}

export const addRendered =
    <R, H, E, C extends ChatState<R, H>>(actionToStateAction:
        (a: RenderedElementsAction) => ChatAction<R, H, ChatState<R, H>, E>[]
    ) =>
        (messageId: number) =>
            actionToStateAction(_addRenderedUserMessage(messageId))

export const ifTextEqual = (text: string) => F.flow(
    contextOpt,
    c => c.messageText,
    O.filter((messageText) => messageText == text),
    O.isSome
)

export const ifStart = ifTextEqual('/start')

export function sequence<R, H, E = BasicAppEvent<R, H>>(
    handlers: AppChatAction<R, H, E>[]
): AppChatAction<R, H, E> {
    return async (ctx): Promise<ChatState<R, H>> => {
        let data = ctx.chatdata
        console.log(handlers);
        
        for (const h of handlers) {
            data = await h({ ...ctx, chatdata: data })
        }
        return data
    }
}

export const applyInputHandler =
    async <R, H, E>(ctx: ChatActionContext<R, H, E>): Promise<ChatState<R, H>> =>
        pipe(
            O.fromNullable(ctx.chatdata.inputHandler),
            O.map(f => f(ctx.tctx)),
            O.chain(O.fromNullable),
            O.fold(() => [], cs => [cs]),
            ctx.app.actionReducer,
            sequence
        )(ctx)

export const applyActionHandler =
    async <R, H, E>(ctx: ChatActionContext<R, H, E>): Promise<ChatState<R, H>> =>
        pipe(
            O.fromNullable(ctx.chatdata.actionHandler),
            O.map(f => f(ctx.tctx)),
            O.chain(O.fromNullable),
            O.fold(() => [], cs => [cs]),
            ctx.app.actionReducer,
            sequence,
        )(ctx)


export type AppChatAction<R, H, E = BasicAppEvent<R, H>> = ChatAction<R, H, ChatState<R, H>, E>

export interface ChatAction<R, H, Returns, E> {
    (ctx: ChatActionContext<R, H, E>): Promise<Returns>
}

export interface ChatActionContext<R, H, E> {
    app: Application<R, H, E>,
    tctx: TelegrafContext,
    // renderer: ChatRenderer,
    queue: OpaqueChatHandler<E>,
    readonly chatdata: ChatState<R, H>
}

export function replyCallback<R, H, E>(
    { tctx, chatdata }: ChatActionContext<R, H, E>
): Promise<ChatState<R, H>> {
    return pipe(
        TE.tryCatch(
            () => tctx.answerCbQuery()
            , mapToChatRendererError
        )
        , TE.fold<ChatRendererError, boolean, ChatState<R, H>>(
            (e) => T.of({...chatdata, error: e.description })
            , (_) => T.of(chatdata)
        )
    )()
}

export function log<R, H, E>(

): AppChatAction<R, H, E> {
    return async (
        ctx: ChatActionContext<R, H, E>
    ) => {
        console.log("LOGGINMG")
        console.log(
            JSON.stringify({ ...(ctx.chatdata as any).store })
        )
        return ctx.chatdata
    }
}
//  XXX
// export const lazy = (ca: CA.AppChatAction<unknown, unknown, unknown>) =>
    // <R, H, E>(): CA.AppChatAction<R, H, E> => ca

export function chatState<R, H, E= BasicAppEvent<R, H>>(
    pred: (state: ChatState<R, H>) => AppChatAction<R, H, E>,
): AppChatAction<R, H, E> {
    return async (
        ctx: ChatActionContext<R, H, E>
    ) => pred(ctx.chatdata)(ctx)
}

export function tctx<R, H, E= BasicAppEvent<R, H>>(
    pred: (ctx: TelegrafContext) => AppChatAction<R, H, E>,
): AppChatAction<R, H, E> {
    return async (
        ctx
    ) => pred(ctx.tctx)(ctx)
}

export function app<R, H, E= BasicAppEvent<R, H>>(
    pred: (app: Application<R, H, E>) => AppChatAction<R, H, E>,
): AppChatAction<R, H, E> {
    return async (
        ctx
    ) => pred(ctx.app)(ctx)
}

export function chain<R, H, E= BasicAppEvent<R, H>>(
    f: (ctx: ChatActionContext<R, H, E>) => AppChatAction<R, H, E>,
): AppChatAction<R, H, E> {
    return async (ctx) => f(ctx)(ctx)
}

export type Branch<R, H, T, E= BasicAppEvent<R, H>> = [
    (ctx: TelegrafContext) => boolean,
    ChatAction<R, H, T, E>[],
    ChatAction<R, H, T, E>[]
]


export function branchHandler<R, H, E = BasicAppEvent<R, H>>(
    handlers: Branch<R, H, ChatState<R, H>, E>[]
): AppChatAction<R, H, E> {
    return async (ctx): Promise<ChatState<R, H>> => {

        let data = ctx.chatdata

        for (const branch of handlers) {
            const [pred, ontrue, onfalse] = branch

            if (pred(ctx.tctx)) {
                for (const a of ontrue) {
                    data = await a({ ...ctx, chatdata: data })
                }
            }
            else {
                for (const a of onfalse) {
                    data = await a({ ...ctx, chatdata: data })
                }
            }
        }

        return data

    }
}

export function mapState<R, H, E>(
    f: (s: ChatState<R, H>) => ChatState<R, H>
): AppChatAction<R, H, E> {
    return async function (ctx) {
        return f(ctx.chatdata)
    }
}

export type PipeChatAction<R, H, E> = AppChatAction<R, H, E>

export const addRenderedUserMessage = <R, H, E>()
    : CA.PipeChatAction<R, H, E> => {
    return CA.tctx(c =>
        CA.mapState(s => ({
            ...s,
            renderedElements: [
                ...s.renderedElements,
                createRenderedMessage(c.message?.message_id!)
            ]
        })))
}

export const flush = async <R, H, E>({ chatdata }: CA.ChatActionContext<R, H, E>)
    : Promise<ChatState<R, H>> =>
    pipe(
        chatdata,
        modifyRenderedElements(_ => [])
    )

export const doNothing = async <R, H, E>({ chatdata }: CA.ChatActionContext<R, H, E>)
    : Promise<ChatState<R, H>> =>
    chatdata


export const onTrue = <R, H, E>(p: boolean, a: AppChatAction<R, H, E>)
: AppChatAction<R, H, E> => p ? a : doNothing
