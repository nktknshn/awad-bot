import * as A from 'fp-ts/lib/Array';
import * as F from 'fp-ts/lib/function';
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import { TelegrafContext } from 'telegraf/typings/context';
import * as CA from './chatactions';
import { ChatHandler2 } from './chathandler';
import { Application, ChatState } from "./application";
import { ChatRenderer } from './chatrenderer';
import { RenderedElementsAction } from './elements';
import { contextOpt, modifyRenderedElements } from './inputhandler';
import { StateAction } from './handlerF';
import { addRenderedUserMessage as _addRenderedUserMessage, createRendered as createRenderedMessage } from './usermessage';
import { Effect } from './draft';
import { mylog } from './logging';
import { printStateTree } from './tree';

export async function render<R, H, E>(
    ctx: ChatActionContext<R, H, E>
): Promise<ChatState<R, H>> {
    return ctx.app.renderFunc(ctx.chatdata).renderFunction(ctx.renderer)
}

export async function applyEffects<R, H, E>(
    ctx: ChatActionContext<R, H, E>
): Promise<ChatState<R, H>> {
    printStateTree(ctx.chatdata.treeState.nextStateTree!)

    const r = ctx.app.renderFunc(ctx.chatdata)
    printStateTree(r.chatdata.treeState.nextStateTree!)

    mylog('Applying Effects')

    const cd = await sequence<R, H, E>(
        ctx.app.actionReducer(r.effects.map(_ => _.element.callback()))
    )({ ...ctx, chatdata: r.chatdata })

    printStateTree(cd.treeState.nextStateTree!)

    return cd
}

export function scheduleEvent
    <R extends { deferredRenderTimer?: NodeJS.Timeout }, H, E>
    (timeout: number, ev: E): AppChatAction<R, H, E> {
    {
        return async function
            ({ chatdata, chat, tctx }) {

            chatdata.deferredRenderTimer && clearTimeout(chatdata.deferredRenderTimer)

            return pipe(
                chatdata,
                c => ({
                    ...c,
                    deferredRenderTimer: setTimeout(
                        () => chat.handleEvent(tctx, ev),
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


export function sequence<R, H, E>(
    handlers: AppChatAction<R, H, E>[]
): AppChatAction<R, H, E> {
    return async (ctx): Promise<ChatState<R, H>> => {
        let data = ctx.chatdata

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
            sequence,
            a => a(ctx),
        )

export const applyActionHandler =
    async <R, H, E>(ctx: ChatActionContext<R, H, E>): Promise<ChatState<R, H>> =>
        pipe(
            O.fromNullable(ctx.chatdata.actionHandler),
            O.map(f => f(ctx.tctx)),
            O.chain(O.fromNullable),
            O.fold(() => [], cs => [cs]),
            ctx.app.actionReducer,
            sequence,
            a => a(ctx),
        )


export type AppChatAction<R, H, E> = ChatAction<R, H, ChatState<R, H>, E>

export interface ChatAction<R, H, Returns, E> {
    (ctx: ChatActionContext<R, H, E>): Promise<Returns>
}

export interface ChatActionContext<R, H, E> {
    app: Application<R, H, E>,
    tctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<E>,
    chatdata: ChatState<R, H>
}

export async function replyCallback<R, H, E>(
    { tctx, chatdata }: ChatActionContext<R, H, E>
): Promise<ChatState<R, H>> {
    return tctx.answerCbQuery().then(_ => chatdata)
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


export function chatState<R, H, E>(
    pred: (state: ChatState<R, H>) => AppChatAction<R, H, E>,
): AppChatAction<R, H, E> {
    return async (
        ctx: ChatActionContext<R, H, E>
    ) => pred(ctx.chatdata)(ctx)
}

export function ctx<R, H, E>(
    pred: (ctx: TelegrafContext) => AppChatAction<R, H, E>,
): AppChatAction<R, H, E> {
    return async (
        ctx
    ) => pred(ctx.tctx)(ctx)
}

export function app<R, H, E>(
    pred: (app: Application<R, H, E>) => AppChatAction<R, H, E>,
): AppChatAction<R, H, E> {
    return async (
        ctx
    ) => pred(ctx.app)(ctx)
}

export function chain<R, H, E>(
    f: (ctx: ChatActionContext<R, H, E>) => AppChatAction<R, H, E>,
): (ctx: ChatActionContext<R, H, E>) => AppChatAction<R, H, E> {
    return (ctx) => f(ctx)
}

export type Branch<R, H, T, E> = [
    (ctx: TelegrafContext) => boolean,
    ChatAction<R, H, T, E>[],
    ChatAction<R, H, T, E>[]
]


export function branchHandler<R, H, E>(
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
    return CA.ctx(c =>
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

export const nothing = async <R, H, E>({ chatdata }: CA.ChatActionContext<R, H, E>)
    : Promise<ChatState<R, H>> =>
    chatdata