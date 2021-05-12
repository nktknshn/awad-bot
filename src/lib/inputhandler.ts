import { Do } from 'fp-ts-contrib/lib/Do';
import * as A from 'fp-ts/lib/Array';
import { flow } from "fp-ts/lib/function";
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import { Lens } from 'monocle-ts';
import { TelegrafContext } from "telegraf/typings/context";
import { Application, ChatState } from "./application";
import { ChatRenderer } from "./chatrenderer";
import { deleteAll } from "./ui";
import { parseFromContext } from './bot-util';
import { ChatAction, ChatActionContext } from './chatactions';
import { RenderedElementsAction } from './elements';
import { RenderDraft } from './elements-to-messages';
import { BotMessage, RenderedElement } from './rendered-messages';
import { StoreAction, StoreF, StoreF2 } from './storeF';
import { applyLocalStateAction, LocalStateAction } from 'Lib/tree2';

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


export const byMessageId = <R, H, E>
    (dh: ((messageId: number) => ChatAction<R, H, ChatState<R, H>, E>)) => (c: ContextOpt) => {
        return pipe(
            Do(O.option)
                .bind('messageId', c.messageId)
                .return(({ messageId }) => {
                    return dh(messageId)
                }),
        )
    }

export async function clearChat<R, H, E>(
    ctx: ChatActionContext<R, H, E>
): Promise<ChatState<R, H>> {
    await deleteAll(ctx.chatdata.renderer, ctx.chatdata.renderedElements)
    return { ...ctx.chatdata, renderedElements: [] }
}

export function applyRenderedElementsAction(a: RenderedElementsAction) {
    return function <R, H, C extends ChatState<R, H>>(cs: C): C {
        return {
            ...cs,
            renderedElements: a.f(cs.renderedElements)
        }
    }
}

export const modifyRenderedElements = (f: (rs: RenderedElement[]) => RenderedElement[]) =>
    <C extends ChatState<R, H>, R, H>(cs: C) => ({
        ...cs,
        renderedElements: f(cs.renderedElements)
    })

export const renderedElementsLens = <R, H>() =>
    Lens.fromProp<ChatState<R, H>>()('renderedElements')

export function applyTreeAction<S>(a: LocalStateAction<S>) {
    return function <R, H>(cs: ChatState<R, H>): ChatState<R, H> {
        return {
            ...cs,
            treeState: {
                ...cs.treeState,
                localStateTree:
                    applyLocalStateAction(cs.treeState?.localStateTree!, a)
            }
        }
    }
}

export function applyChatStateAction<C>(f: (s: C) => C) {
    return function (cs: C): C {
        return f(cs)
    }
}

export function applyStoreAction<S>
    (a: StoreAction<S>) {
    return function <C extends ChatState<R, H>, R extends { store: StoreF<S> }, H>(cs: C): ChatState<R, H> {
        return {
            ...cs,
            store: cs.store.applyAction(a)
        }
    }
}

export function applyStoreAction2<S>(a: StoreAction<S>) {
    return function <R extends { store: StoreF<S> }, H>(cs: ChatState<R, H>): ChatState<R, H> {
        return {
            ...cs,
            store: cs.store.applyAction(a)
        }
    }
}

export function applyStoreAction3<S, K extends keyof any, SH>(
    key: K,
    a: SH
    ) {
    return function
        <R extends Record<K, StoreF2<S, any>>, H>(
            cs: ChatState<R, H>): ChatState<R, H> {
        return {
            ...cs,
            [key]: cs[key].applyAction(a)
        }
    }
}


export const chainInputHandlers = <D, R>
    (hs: ((d: D, n: () => R | undefined) => R | undefined)[], d: D): R | undefined =>
    hs && hs.length
        ? hs[0](d, () => chainInputHandlers(hs.slice(1), d))
        : undefined

