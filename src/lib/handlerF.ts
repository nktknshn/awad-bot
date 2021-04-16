import * as O from 'fp-ts/lib/Option';
import { TelegrafContext } from 'telegraf/typings/context';
import { ChatHandler2, ChatState } from './chathandler';
import { ChatRenderer } from './chatrenderer';
import { InputHandlerElement } from "./elements";
import { InputHandlerData } from "./messages";

interface ActionF<S> {
    (s: S): S
}

// export type ActionG<S> = Generator<Action<S> | ActionG<S>>

export type Action<S> = ActionF<S>
//  | ActionG<S>

export class InputHandlerElementF<S> {
    kind: 'InputHandlerElementF' = 'InputHandlerElementF'
    constructor(
        readonly callback: (
            input: InputHandlerData,
            next?: () => Action<S>,
        ) => (Action<S> | undefined)
    ) { }
}

export type Matcher2<S> = (d: O.Option<InputHandlerData>) => O.Option<undefined | Action<S> | 'done' | 'next'>;

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
            return  next ? next() : undefined;
        }
    );
}


export class ButtonElementF<S> {
    kind: 'ButtonElementF' = 'ButtonElementF'
    constructor(
        readonly text: string,
        readonly data?: string,
        readonly callback?: () => ActionF<S> | undefined,
    ) { }

}

export function buttonF<S>(
    text: (string | [string, string]),
    callback: () => (ActionF<S> | undefined)
) {

    let [buttonText, data] = Array.isArray(text) ? text : [text, text]

    return new ButtonElementF(buttonText, data, callback)
}

export class InputHandlerF<S> {
    kind: 'InputHandlerF' = 'InputHandlerF'
    constructor(public readonly  element: InputHandlerElementF<S>) {}
}

export const defaultHF =  <R extends 
{inputHandlerF?: (ctx: TelegrafContext) => O.Option<(s: T) => T>}, T, H>(messageId: number) => {
    return async function def(
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<ChatState<R, H>>,
        chatdata: ChatState<R, H>,
    ) {
        // if (chatdata.inputHandler(ctx))
        //     await renderer.delete(messageId)

        if(chatdata.inputHandlerF)
            return chatdata.inputHandlerF(ctx)
        // mylog("defaultH");
        
        // await chat.handleEvent(ctx, "updated")
    }
}
