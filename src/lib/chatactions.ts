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
import { RenderedElementsAction } from './elements';

export async function render<R, H, E, C extends ChatState<R, H>>(
    app: Application<C, H>,
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<E>,
    chatdata: C
): Promise<C> {
    return app.renderFunc(chatdata)[1](renderer)
}

export function scheduleRender
    <R extends { deferredRenderTimer?: NodeJS.Timeout }, H, E, C extends ChatState<R, H>>
    (timeout: number, ev: E): ChatAction<R, H, C, E, C> {
    {
        return async function
            (app, ctx, renderer, chat, chatdata) {

            chatdata.deferredRenderTimer && clearTimeout(chatdata.deferredRenderTimer)

            return pipe(
                chatdata,
                c => ({
                    ...c,
                    deferredRenderTimer: setTimeout(
                        () => chat.handleEvent(ev),
                        timeout
                    )
                })
            )
        }
    }
}

export const applyActions = <S>(data: S) => (as: StateAction<S>[]) => pipe(as, A.reduce(data, (cd, f) => f(cd)))
export const applyActionsF = <S>(as: StateAction<S>[]) => (data: S) => applyActions(data)(as)

export const addRendered = <S>
    (actionToStateAction: (a: RenderedElementsAction) => StateAction<S>[]) =>
    (messageId: number) =>
        actionToStateAction(addRenderedUserMessage(messageId))

export function addToRendered<R, H, E, C extends ChatState<R, H>>
    (actionToStateAction: <M>(a: RenderedElementsAction & M) => StateAction<C>[])
    : ChatAction<R, H, C, E, C> {
    return async function
        (app, ctx, renderer, chat, chatdata) {
        return pipe(
            chatdata,
            applyActionsF(
                addRendered(actionToStateAction)(ctx.message?.message_id!))
        )
    }

}
export const ifTextEqual = (text: string) => F.flow(
    contextOpt,
    c => c.messageText,
    O.filter((messageText) => messageText == text),
    O.isSome
)

export const ifStart = F.flow(
    contextOpt,
    c => c.messageText,
    O.filter((messageText) => messageText == '/start'),
    O.isSome
)

export function applyInputHandler<R, H, E, C extends ChatState<R, H>>
    (actionToStateAction: <M>(a: (H & M) | (H & M)[]) => StateAction<C>[])
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
            applyActions(chatdata)
        )
}

export function chatState<R, H, T, E, C extends ChatState<R, H>>(
    pred: (state: C) => ChatAction<R, H, C, E, C>,
): ChatAction<R, H, C, E, C> {
    return async (
        app, ctx, renderer, chat, chatdata
    ) => pred(chatdata)(app, ctx, renderer, chat, chatdata)
}

export function ctx<R, H, T, E, C extends ChatState<R, H>>(
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