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


export type HandlerAction<R, H, A, T> = (a: A) => ChatAction<R, H, T>

export const deleteMessage = <R, H>(messageId: number): ChatAction<R, H, void> => {
    return async function (
        app, ctx, renderer, chat, chatdata
    ) {
        await renderer.delete(messageId)
    }
}

type ThisOrArray<T> = T | T[]

export const getActions = <R extends any, H extends any>(): ChatAction<R, H, H | undefined | H[]> => {
    return async function (
        app, ctx, renderer, chat, chatdata
    ) {
        if (!chatdata.inputHandler)
            return

        return chatdata.inputHandler(ctx)
    }
}

export type StateAction<S> = (s: S) => S

export const routeAction = <R, H>(mf: (a: H) => StateAction<ChatState<R, H>>[])
    : HandlerAction<R, H, ThisOrArray<H | undefined>, void> =>
    (a): ChatAction<R, H, void> => {
        return async function (
            app, ctx, renderer, chat, chatdata
        ) {
            mylog(`routeAction message_id: ${ctx.message?.message_id}`)

            if (!a)
                return

            if (!Array.isArray(a))
                a = [a]

            // return await Promise.all(
            //     mf(a).map(a => chat.handleEvent(ctx, "updated", a))
            // ).then(_ => { })
            const func = a.filter(_ => _ !== undefined).map(a => mf(a!)).reduce((acc, cur) => [...acc, ...cur], [])

            mylog(`func`, func)
            mylog(`a`, a)

            if (func.length)
                return await chat.handleEvent(func)
        }
    }

export const connect = <R, H, A1, R1 extends A2, A2, R3>(
    h1: HandlerAction<R, H, A1, R1>,
    h2: HandlerAction<R, H, A2, R3>,
): HandlerAction<R, H, A1, R3> => {

    return (a: A1) =>
        async (app, ctx, render, chat, aa) => {
            const r = await h1(a)(app, ctx, render, chat, aa)
            mylog(`TRACE connect ${r}`)
            return await h2(r)(app, ctx, render, chat, aa)
        }

}
