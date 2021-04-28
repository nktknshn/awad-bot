import * as O from 'fp-ts/lib/Option';
import { TelegrafContext } from 'telegraf/typings/context';
import { ChatAction } from './chatactions';
import { ChatHandler2, ChatState } from './chathandler';
import { ChatRenderer } from './chatrenderer';
import { InputHandlerData } from "./messages";


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


export type HandlerAction<R, H, E, A, T> = (a: A) => ChatAction<R, H, T, E>

// export const deleteMessage = <R, H, E>(messageId: number)
//     : ChatAction<R, H, void, E> => {
//     return async function (
//         { renderer }
//     ) {
//         await renderer.delete(messageId)
//     }
// }

export type StateAction<S> = (s: S) => S
