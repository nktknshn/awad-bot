import { TelegrafContext } from "telegraf/typings/context";
import { ChatRenderer, createChatRendererE } from "./chatrenderer";
import { RenderedElement } from "./rendered-messages";
import { TreeState } from "./tree2";
import { RenderedUserMessage } from "./usermessage";
import * as A from 'fp-ts/lib/Array';
import { contextSelector } from "./context";
import { GetChatState } from "./types-util";

export const empty = <T>(): T | undefined => undefined

export const getUserMessages = <R, H>(c: ChatState<R, H>): number[] => {
    return A.flatten(c.renderedElements.filter((_): _ is RenderedUserMessage => _.kind === 'RenderedUserMessage')
        .map(_ => _.outputIds()));
};

export type GetSubState<T> = T extends (...args: any[]) => Promise<infer S> ? S : never 

export const stateSelector = <chatState>(state: chatState) => contextSelector<GetChatState<chatState>>()

export const subStateSelector = <chatState>(substate: chatState) => contextSelector<GetSubState<chatState>>()

export function chatState<R1>(
    fs: [((tctx: TelegrafContext) => Promise<R1>)],
): <H>(tctx: TelegrafContext) => Promise<ChatState<R1, H>>
export function chatState<R1, R2>(
    fs: [
        ((tctx: TelegrafContext) => Promise<R1>),
        ((tctx: TelegrafContext) => Promise<R2>),
    ],
): <H>(tctx: TelegrafContext) => Promise<ChatState<R1 & R2, H>>
export function chatState<R1, R2, R3>(
    fs: [
        ((tctx: TelegrafContext) => Promise<R1>),
        ((tctx: TelegrafContext) => Promise<R2>),
        ((tctx: TelegrafContext) => Promise<R3>),

    ],
): <H>(tctx: TelegrafContext) => Promise<ChatState<R1 & R2 & R3, H>>
export function chatState<R1, R2, R3, R4>(
    fs: [
        ((tctx: TelegrafContext) => Promise<R1>),
        ((tctx: TelegrafContext) => Promise<R2>),
        ((tctx: TelegrafContext) => Promise<R3>),
        ((tctx: TelegrafContext) => Promise<R4>),

    ],
): <H>(tctx: TelegrafContext) => Promise<ChatState<R1 & R2 & R3 & R4, H>>

export function chatState<R1, R2, R3, R4, R5>(
    fs: [
        ((tctx: TelegrafContext) => Promise<R1>),
        ((tctx: TelegrafContext) => Promise<R2>),
        ((tctx: TelegrafContext) => Promise<R3>),
        ((tctx: TelegrafContext) => Promise<R4>),
        ((tctx: TelegrafContext) => Promise<R5>),
    ],
): <H>(tctx: TelegrafContext) => Promise<ChatState<R1 & R2 & R3 & R4 & R5, H>>

export function chatState<R1, R2, R3, R4, R5, R6>(
    fs: [
        ((tctx: TelegrafContext) => Promise<R1>),
        ((tctx: TelegrafContext) => Promise<R2>),
        ((tctx: TelegrafContext) => Promise<R3>),
        ((tctx: TelegrafContext) => Promise<R4>),
        ((tctx: TelegrafContext) => Promise<R5>),
        ((tctx: TelegrafContext) => Promise<R6>),
    ],
): <H>(tctx: TelegrafContext) => Promise<ChatState<R1 & R2 & R3 & R4 & R5 & R6, H>>

export function chatState(fs: any[]) {
    return async (tctx: TelegrafContext) => ({
        treeState: undefined,
        renderedElements: [],
        renderer: createChatRendererE(tctx),
        ...((await Promise.all(fs.map(_ => _(tctx))))
            .reduce((acc, cur) => ({ ...acc, ...cur }), {}))
    })
}
export type ChatState<R, H> = {
    readonly renderedElements: RenderedElement[];
    readonly treeState?: TreeState;
    readonly inputHandler?: (ctx: TelegrafContext) => (H | undefined);
    readonly actionHandler?: (ctx: TelegrafContext) => H;
    readonly error?: string,
    renderer: ChatRenderer,
} & Readonly<R>;
