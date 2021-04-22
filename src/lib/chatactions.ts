import * as A from 'fp-ts/lib/Array';
import * as O from 'fp-ts/lib/Option';
import * as F from 'fp-ts/lib/function';
import * as T from 'fp-ts/lib/Task';
import { pipe } from "fp-ts/lib/pipeable";
import { StateAction } from './handlerF'
import { ChatAction, contextOpt } from './handler';
import { Application, ChatHandler2, ChatState } from './chathandler';
import { TelegrafContext } from 'telegraf/typings/context';
import { ChatRenderer } from './chatrenderer';
import { addRenderedUserMessage } from './usermessage';
import { RenderedElementsAction, Subtract } from './elements';

export async function render<R, H, E, C extends ChatState<R, H>>(
    app: Application<C, H, E>,
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<E>,
    chatdata: C
): Promise<C> {
    return app.renderFunc(chatdata)[1](renderer)
}

export function scheduleEvent
    <R extends { deferredRenderTimer?: NodeJS.Timeout }, H, E, C extends ChatState<R, H>, EE extends E>
    (timeout: number, ev: EE): ChatAction<R, H, C, E, C> {
    {
        return async function
            (app, ctx, renderer, chat, chatdata) {

            chatdata.deferredRenderTimer && clearTimeout(chatdata.deferredRenderTimer)

            return pipe(
                chatdata,
                c => ({
                    ...c,
                    deferredRenderTimer: setTimeout(
                        () => chat.handleEvent(ctx, ev),
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
        (a: RenderedElementsAction) => ChatAction<R, H, C, E, C>[]
    ) =>
        (messageId: number) =>
            actionToStateAction(addRenderedUserMessage(messageId))

// function wrapToAction

export function addToRendered<R, H, E, C extends ChatState<R, H>>
    (actionToStateAction: (a: RenderedElementsAction) => ChatAction<R, H, C, E, C>[])
    : ChatAction<R, H, C, E, C> {
    return async function
        (app, ctx, renderer, chat, chatdata) {

        const as = addRendered(actionToStateAction)(ctx.message?.message_id!)

        return await runActionsChain(as)(app, ctx, renderer, chat, chatdata)
            // applyActionsF(
            //     addRendered(actionToStateAction)(ctx.message?.message_id!))
    }

}
export const ifTextEqual = (text: string) => F.flow(
    contextOpt,
    c => c.messageText,
    O.filter((messageText) => messageText == text),
    O.isSome
)

export const ifStart = ifTextEqual('/start')

export function applyInputHandler<R, H, E, C extends ChatState<R, H>>
    (actionToStateAction: <M extends H>(a: M | M[]) => ChatAction<R, H, C, E, C>[])
    : ChatAction<R, H, C, E, C> {
    return async (
        app, ctx, renderer, chat, chatdata
    ): Promise<C> =>
        pipe(
            O.fromNullable(chatdata.inputHandler),
            O.map(f => f(ctx)),
            O.chain(O.fromNullable),
            O.fold(() => [], cs => [cs]),
            actionToStateAction,
            // applyActions(chatdata)
            hs => runActionsChain(hs),
            a => a(app, ctx, renderer, chat, chatdata),
        )
}

export function runActionsChain<R, H, E, C extends ChatState<R, H>>(
    hs: ChatAction<R, H, C, E, C>[]
): ChatAction<R, H, C, E, C> {
    return async function (app, ctx, renderer, chat, chatdata) {
        let data = chatdata
        for (const h of hs) {
            data = await h(app, ctx, renderer, chat, data)
        }
        return data
    }
}

export function applyActionHandler<R, H, E, C extends ChatState<R, H>>
    (actionToStateAction: <M>(a: (H & M) | (H & M)[]) => ChatAction<R, H, C, E, C>[])
    : ChatAction<R, H, C, E, C> {
    return async (
        app, ctx, renderer, chat, chatdata
    ): Promise<C> =>
        pipe(
            O.fromNullable(chatdata.actionHandler),
            O.map(f => f(ctx)),
            O.chain(O.fromNullable),
            O.fold(() => [], cs => [cs]),
            actionToStateAction,
            hs => runActionsChain(hs),
            a => a(app, ctx, renderer, chat, chatdata),
            // r => r,
            // applyActions(chatdata)
        )
}

export function applyActionHandler2<R, E, C extends ChatState<R, H1 | H2>, H1, H2>
    (
        getHandler: (c: C) => ((ctx: TelegrafContext) => H1 | H2) | undefined,
        filt: (a: H1 | H2) => a is H1,
        func1: (a: (H1)[]) => ChatAction<R, H1 | H2, C, E, C>,
        actionToStateAction: (a: H2 | H2[]) => StateAction<C>[]
    ): ChatAction<R, H1 | H2, C, E, C> {
    return async (
        app, ctx, renderer, chat, chatdata
    ): Promise<C> =>
        pipe(
            O.fromNullable(getHandler(chatdata)),
            O.map(f => f(ctx)),
            O.chain(O.fromNullable),
            O.fold(() => [], cs => [cs]),
            A.partition(filt),
            ({ left, right }) => func1(right)(app, ctx, renderer, chat, chatdata)
                .then((s) => pipe(
                    left as H2[],
                    actionToStateAction,
                    applyActions(s)
                )),
        )
}

export async function replyCallback<R, H, E, C extends ChatState<R, H>>(
    app: Application<C, H, E>,
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<E>,
    chatdata: C
): Promise<C> {
    return ctx.answerCbQuery().then(_ => chatdata)
}


export function chatState<R, H, T, E, C extends ChatState<R, H>>(
    pred: (state: C) => ChatAction<R, H, C, E, C>,
): ChatAction<R, H, C, E, C> {
    return async (
        app, ctx, renderer, chat, chatdata
    ) => pred(chatdata)(app, ctx, renderer, chat, chatdata)
}

export function ctx<R, H, E, C extends ChatState<R, H>>(
    pred: (ctx: TelegrafContext) => ChatAction<R, H, C, E, C>,
): ChatAction<R, H, C, E, C> {
    return async (
        app, ctx, renderer, chat, chatdata
    ) => pred(ctx)(app, ctx, renderer, chat, chatdata)
}


export type Branch<R, H, T, E, C extends ChatState<R, H>> = [
    (ctx: TelegrafContext) => boolean,
    ChatAction<R, H, T, E, C>[],
    ChatAction<R, H, T, E, C>[]
]

export function listHandler<R, H, E, C extends ChatState<R, H>>(
    handlers: ChatAction<R, H, C, E, C>[]
): ChatAction<R, H, C, E, C> {
    return async (app, ctx, renderer, queue, chatdata): Promise<C> => {
        let data = chatdata

        for (const h of handlers) {
            data = await h(app, ctx, renderer, queue, data)
        }
        return data
    }
}

export function branchHandler<R, H, E, C extends ChatState<R, H>>(
    handlers: Branch<R, H, C, E, C>[]
): ChatAction<R, H, C, E, C> {
    return async (app, ctx, renderer, queue, chatdata): Promise<C> => {

        let data = chatdata

        for (const branch of handlers) {
            const [pred, ontrue, onfalse] = branch

            if (pred(ctx)) {
                for (const a of ontrue) {
                    data = await a(app, ctx, renderer, queue, data)
                }
            }
            else {
                for (const a of onfalse) {
                    data = await a(app, ctx, renderer, queue, data)
                }
            }
        }

        return data

    }
}

export function pipeState<R, H, E, C extends ChatState<R, H>>(
    f: (s: C) => C
): ChatAction<R, H, C, E, C> {
    return async function(app, ctx, renderer, chat, chatdata) {
        return f(chatdata)
    }
}