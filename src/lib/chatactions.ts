import * as A from 'fp-ts/lib/Array';
import * as F from 'fp-ts/lib/function';
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import { TelegrafContext } from 'telegraf/typings/context';
import * as CA from './chatactions';
import { Application, ChatHandler2, ChatState } from './chathandler';
import { ChatRenderer } from './chatrenderer';
import { RenderedElementsAction } from './elements';
import { contextOpt } from './handler';
import { StateAction } from './handlerF';
import { addRenderedUserMessage, createRendered as createRenderedMessage } from './usermessage';

export async function render<R, H, E>(
    ctx: ChatActionContext<R, H, E>
): Promise<ChatState<R, H>> {
    return ctx.app.renderFunc(ctx.chatdata)[1](ctx.renderer)
}

export function scheduleEvent
    <R extends { deferredRenderTimer?: NodeJS.Timeout }, H, E, EE extends E>
    (timeout: number, ev: EE): AppChatAction<R, H, E> {
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

export const applyActions = <S>(data: S) => (as: StateAction<S>[]) => pipe(as, A.reduce(data, (cd, f) => f(cd)))
export const applyActionsF = <S>(as: StateAction<S>[]) => (data: S) => applyActions(data)(as)

export const addRendered =
    <R, H, E, C extends ChatState<R, H>>(actionToStateAction:
        (a: RenderedElementsAction) => ChatAction<R, H, ChatState<R, H>, E>[]
    ) =>
        (messageId: number) =>
            actionToStateAction(addRenderedUserMessage(messageId))

export const ifTextEqual = (text: string) => F.flow(
    contextOpt,
    c => c.messageText,
    O.filter((messageText) => messageText == text),
    O.isSome
)

export const ifStart = ifTextEqual('/start')

export function applyInputHandler<R, H, E>
    (): AppChatAction<R, H, E> {
    return async (
        ctx
    ): Promise<ChatState<R, H>> =>
        pipe(
            O.fromNullable(ctx.chatdata.inputHandler),
            O.map(f => f(ctx.tctx)),
            O.chain(O.fromNullable),
            O.fold(() => [], cs => [cs]),
            ctx.app.actionToChatAction,
            runActionsChain,
            a => a(ctx),
        )
}

export function runActionsChain<R, H, E>(
    hs: AppChatAction<R, H, E>[]
): AppChatAction<R, H, E> {
    return async function (ctx) {
        let data = ctx.chatdata
        for (const h of hs) {
            console.log(hs);

            data = await h({ ...ctx, chatdata: data })
        }
        return data
    }
}

export function applyActionHandler<R, H, E>
    (): AppChatAction<R, H, E> {
    return async (
        ctx
    ): Promise<ChatState<R, H>> =>
        pipe(
            O.fromNullable(ctx.chatdata.actionHandler),
            O.map(f => f(ctx.tctx)),
            O.chain(O.fromNullable),
            O.fold(() => [], cs => [cs]),
            ctx.app.actionToChatAction,
            runActionsChain,
            a => a(ctx),
        )
}

export function applyActionHandler2<R, E, H1, H2>
    (
        getHandler: (c: ChatState<R, H1 | H2>) => ((ctx: TelegrafContext) => H1 | H2) | undefined,
        filt: (a: H1 | H2) => a is H1,
        func1: (a: (H1)[]) => AppChatAction<R, H1 | H2, E>,
        actionToStateAction: (a: H2 | H2[]) => StateAction<ChatState<R, H1 | H2>>[]
    ): AppChatAction<R, H1 | H2, E>{
    return async (
        ctx
    ): Promise<ChatState<R, H1 | H2>> =>
        pipe(
            O.fromNullable(getHandler(ctx.chatdata)),
            O.map(f => f(ctx.tctx)),
            O.chain(O.fromNullable),
            O.fold(() => [], cs => [cs]),
            A.partition(filt),
            ({ left, right }) => func1(right)(ctx)
                .then((s) => pipe(
                    left as H2[],
                    actionToStateAction,
                    applyActions(s)
                )),
        )
}

export type AppChatAction<R, H, E> = ChatAction<R, H, ChatState<R, H>, E>

export interface ChatAction<R, H, T, E> {
    (ctx: ChatActionContext<R, H, E>): Promise<T>
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



export type Branch<R, H, T, E> = [
    (ctx: TelegrafContext) => boolean,
    ChatAction<R, H, T, E>[],
    ChatAction<R, H, T, E>[]
]

export function fromList<R, H, E>(
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

export function pipeState<R, H, E>(
    f: (s: ChatState<R, H>) => ChatState<R, H>
): AppChatAction<R, H, E> {
    return async function (ctx) {
        return f(ctx.chatdata)
    }
}

export type PipeChatAction<R, H, E> = AppChatAction<R, H, E>

export const createRendered = <R, H, E>()
    : CA.PipeChatAction<R, H, E> => {
    return CA.ctx(c =>
        CA.pipeState(s => ({
            ...s,
            renderedElements: [
                ...s.renderedElements,
                createRenderedMessage(c.message?.message_id!)
            ]
        })))
}