import * as O from 'fp-ts/lib/Option';
import { TelegrafContext } from 'telegraf/typings/context';
import { ChatHandler2, ChatState } from './chathandler';
import { ChatRenderer } from './chatrenderer';
import { InputHandlerElement } from "./elements";
import { ChatAction } from './handler';
import { mylog } from './logging';
import { InputHandlerData } from "./messages";

// interface ActionF<S> {
//     (s: S): S
// }

// export type ActionG<S> = Generator<Action<S> | ActionG<S>>

// export type Action<S> = ActionF<S>
//  | ActionG<S>

export class InputHandlerElementF<S> {
    kind: 'InputHandlerElementF' = 'InputHandlerElementF'
    constructor(
        readonly callback: (
            input: InputHandlerData,
            next?: () => S,
        ) => (S | undefined)
    ) { }
}

export type Matcher2<S> = (d: O.Option<InputHandlerData>) => O.Option<undefined | S | 'done' | 'next'>;

export function inputHandlerF<S>(
    ...matchers: Matcher2<S>[]
) {
    return new InputHandlerElementF<S>(
        (data, next) => {

            for (const m of matchers) {
                const res = m(O.of(data));

                if (O.isSome(res))
                    switch (res.value) {
                        case 'next': continue;
                        case 'done': return next ? next() : undefined;
                        case undefined: return;
                        default: return res.value;
                    }
            }
            return next ? next() : undefined;
        }
    );
}


export class ButtonElementF<S> {
    kind: 'ButtonElementF' = 'ButtonElementF'
    constructor(
        readonly text: string,
        readonly data?: string,
        readonly callback?: () => S | undefined,
    ) { }

}

export function buttonF<S>(
    text: (string | [string, string]),
    callback: () => (S | undefined)
) {

    let [buttonText, data] = Array.isArray(text) ? text : [text, text]

    return new ButtonElementF(buttonText, data, callback)
}

export class InputHandlerF<S> {
    kind: 'InputHandlerF' = 'InputHandlerF'
    constructor(public readonly element: InputHandlerElementF<S>) { }
}

export const defaultHF = <R extends
    { inputHandlerF?: (ctx: TelegrafContext) => O.Option<(s: T) => T> }, T, H>(messageId: number) => {
    return async function def(
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<ChatState<R, H>>,
        chatdata: ChatState<R, H>,
    ) {
        // if (chatdata.inputHandler(ctx))
        //     await renderer.delete(messageId)

        if (chatdata.inputHandlerF)
            return chatdata.inputHandlerF(ctx)
        // mylog("defaultH");

        // await chat.handleEvent(ctx, "updated")
    }
}


export type HandlerAction<A, R, H, T> = (a: A) => ChatAction<R, H, T>

export const deleteMessage = <R, H>(messageId: number): ChatAction<R, H, (H | undefined)> => {
    return async function (
        ctx, renderer, chat, chatdata
    ) {
        if (!chatdata.inputHandler)
            return

        mylog(`TRACE chatdata.inputHandler ${ctx.message?.message_id}`)

        const cs = chatdata.inputHandler(ctx)
        mylog(`deleteMessage ${ctx.message?.message_id}`)

        await renderer.delete(messageId)
        mylog(`TRACE removed ${ctx.message?.message_id}`)


        if (!cs)
            return

        return cs
        // // @ts-ignore TS2345
        // return Promise.all(
        //     actionToStateAction(cs).map(a => chat.handleEvent(ctx, "updated", a))
        // ).then(_ => { })
    }
}
export type StateAction<S> = (s: S) => S

export const routeAction = <R, H>(mf: (a: H) => StateAction<ChatState<R, H>>[])
    : HandlerAction<H | undefined, R, H, void> =>
    (a): ChatAction<R, H, void> => {
        return async function (
            ctx, renderer, chat, chatdata
        ) {
            mylog(`routeAction ${ctx.message?.message_id}`)

            if (!a)
                return

            return await Promise.all(
                mf(a).map(a => chat.handleEvent(ctx, "updated", a))
            ).then(_ => { })

            // // @ts-ignore TS2345
            // return Promise.all(
            //     actionToStateAction(cs).map(a => chat.handleEvent(ctx, "updated", a))
            // ).then(_ => { })
        }
    }

export const connect = <A1, R, H, T1, T2>(
    h1: HandlerAction<A1, R, H, T1>,
    h2: HandlerAction<T1, R, H, T2>,
): HandlerAction<A1, R, H, T2> => {

    return (a: A1) =>
        async (ctx, render, chat, aa) => {
            const r = await h1(a)(ctx, render, chat, aa)
            mylog(`TRACE connect ${r}`)
            return await h2(r)(ctx, render, chat, aa)
        }

}
