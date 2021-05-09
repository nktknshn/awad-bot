import * as A from 'fp-ts/lib/Array';
import * as O from 'fp-ts/lib/Option';
import * as E from 'fp-ts/lib/Either';

import { pipe } from "fp-ts/lib/pipeable";
import { OpaqueChatHandler, QueuedChatHandler } from 'Lib/chathandler';
import { ChatHandlerFactory } from 'Lib/chatsdispatcher';
import { createElements, TreeState } from 'Lib/tree2';
import { TelegrafContext } from "telegraf/typings/context";
import { parseFromContext } from './bot-util';
import * as CA from './chatactions';
import { AppChatAction, ChatActionContext } from "./chatactions";
import { ChatRenderer, ChatRendererError, createChatRendererE as createChatRenderer } from "./chatrenderer";
import { ComponentElement } from "./component";
import { createDraftWithImages, Effect } from "./draft";
import { BasicElement, EffectElement } from "./elements";
import { RenderDraft } from "./elements-to-messages";
import { chainInputHandlers, contextOpt, findRepliedTo } from './inputhandler';
import { mylog } from "./logging";
import { createRenderActions, RenderActions } from "./render-actions";
import { BotMessage, RenderedElement } from "./rendered-messages";
import { AppActionsFlatten, ComponentReqs, GetAllBasics, If, IfDef } from "./types-util";
import { renderActions as applyRenderActions } from "./ui";
import { RenderedUserMessage, UserMessageElement } from "./usermessage";
import { identity } from 'fp-ts/lib/function';
import { PhotoGroupElement } from 'bot3/mediagroup';
import Telegraf from 'telegraf';


export type ChatState<R, H> = {
    readonly renderedElements: RenderedElement[];
    readonly treeState?: TreeState;
    readonly inputHandler?: (ctx: TelegrafContext) => (H | undefined);
    readonly actionHandler?: (ctx: TelegrafContext) => H;
    readonly error?: string
} & Readonly<R>;


export function getInputHandler<Draft extends RenderDraft<H>, H>(draft: Draft): ((ctx: TelegrafContext) => H | undefined) {
    return ctx => chainInputHandlers(
        draft.inputHandlers.reverse().map(_ => _.element.callback),
        parseFromContext(ctx)
    );
}

export const getActionHandler = <A>(rs: RenderedElement[]) => {
    return function (ctx: TelegrafContext): A | undefined {
        const { action, repliedTo } = contextOpt(ctx);
        const p = pipe(
            repliedTo,
            O.map(findRepliedTo(rs)),
            O.chain(O.fromNullable),
            O.filter((callbackTo): callbackTo is BotMessage => callbackTo.kind === 'BotMessage'),
            O.chain(callbackTo => pipe(action, O.map(action => ({ callbackTo, action })))),
            O.chainNullableK(({ callbackTo, action }) => callbackTo.input.callback2(action))
        );

        if (O.isSome(p)) {
            return p.value;
        }
    };
};

export const getUserMessages = <R, H>(c: ChatState<R, H>): number[] => {
    return A.flatten(c.renderedElements.filter((_): _ is RenderedUserMessage => _.kind === 'RenderedUserMessage')
        .map(_ => _.outputIds()));
};

export const createChatState = <R, H>(r: R): ChatState<R, H> => ({
    treeState: undefined,
    renderedElements: [],
    ...r
}) as ChatState<R, H>;

export function createChatState2<R0, R1, R, H>(
    fs: [((tctx: TelegrafContext) => Promise<R1>)],
    r: R0
): (tctx: TelegrafContext) =>  Promise<ChatState<R0 & R1, H>> 
export function createChatState2<R0, R1, R2, R, H>(
    fs: [
        ((tctx: TelegrafContext) => Promise<R1>),
        ((tctx: TelegrafContext) => Promise<R2>),
    ],
    r: R0
): (tctx: TelegrafContext) =>  Promise<ChatState<R0 & R1 & R2, H>> 
export function createChatState2<R0, R1, R2, R3, R, H>(
    fs: [
        ((tctx: TelegrafContext) => Promise<R1>),
        ((tctx: TelegrafContext) => Promise<R2>),
        ((tctx: TelegrafContext) => Promise<R3>),
    ],
    r: R0
): (tctx: TelegrafContext) =>  Promise<ChatState<R0 & R1 & R2 & R3, H>> 

export function createChatState2(fs: any[], r: any)
{
    return  async (tctx: TelegrafContext) => ({
        treeState: undefined,
        renderedElements: [],
        ...(await Promise.all(fs.map(_ => _(tctx)))),
        ...r
    })
}


export interface Application<R, H, E> {
    chatStateFactory: (ctx: TelegrafContext) => Promise<ChatState<R, H>>;
    renderer?: (ctx: TelegrafContext) => ChatRenderer;
    renderFunc: (state: ChatState<R, H>) => {
        chatdata: ChatState<R, H>;
        renderFunction: (renderer: ChatRenderer) => Promise<ChatState<R, H>>;
        effects: Effect<H>[]
    };
    init?: AppChatAction<R, H, E>;
    handleMessage: AppChatAction<R, H, E>;
    handleAction?: AppChatAction<R, H, E>;
    handleEvent: (
        ctx: ChatActionContext<R, H, E>,
        event: E
    ) => Promise<ChatState<R, H>>;
    queueStrategy?: () => void;
    actionReducer: (a: H | H[]) => AppChatAction<R, H, E>[];
}

export const defaultHandleAction = () => CA.sequence(
    [CA.applyActionHandler, CA.replyCallback, CA.render]
)

export function application<R = {}, H = never, E = {},
    NeverNever extends IfDef<H, {}, never> = IfDef<H, {}, never>>(
        app: Application<R, H, E> & NeverNever
    ): Application<R, H, E> {
    return app;
}

interface RenderSource<
    Props,
    RootComponent extends ComponentElement,
    ContextReqs extends ComponentReqs<RootComponent>, R, H> {
    component: (props: Props) => RootComponent;
    props: Props;
    contextCreator: (c: ChatState<R, H>) => Readonly<ContextReqs>;
}

export function fromSource<
    Props,
    RootComponent extends ComponentElement,
    ContextReqs extends ComponentReqs<RootComponent>,
    R, H
>(src: RenderSource<Props, RootComponent, ContextReqs, R, H>) {
    return src;
}

interface RenderScheme<Els, H> {
    createDraft: (els: Els[]) => RenderDraft<H>;
    getInputHandler: (draft: RenderDraft<H>) => (ctx: TelegrafContext) => H | undefined;
    getActionHandler: <A>(rs: RenderedElement[]) => (ctx: TelegrafContext) => A | undefined;
    getEffects: (removedElements: Els[], newElements: Els[]) => Effect<H>[]
}

function getScheme<Els, H>(s: RenderScheme<Els, H>) {
    return s;
}

export const defaultRenderScheme = <H>() => getScheme({
    createDraft: (els: (PhotoGroupElement | UserMessageElement | BasicElement<H>)[]) =>
        createDraftWithImages<H>(els),
    getInputHandler,
    getActionHandler,
    getEffects: (removedElements, newElements) => [
        ...removedElements.filter((_): _ is EffectElement<H> =>
            _.kind === 'EffectElement' && _.type === 'OnRemoved').map(
                compel => new Effect(compel)
            ),
        ...newElements.filter((_): _ is EffectElement<H> =>
            _.kind === 'EffectElement' && _.type === 'OnCreated').map(
                compel => new Effect(compel)
            ),
    ]
});

const renderFunction = <Ctx, HandlerReturn, Els>(
    renderActions: RenderActions[],
    chatState: ChatState<Ctx, HandlerReturn>,
    scheme: RenderScheme<Els, HandlerReturn>,
) =>
    async (renderer: ChatRenderer): Promise<ChatState<Ctx, HandlerReturn>> => {
        const renderedElementsE = await applyRenderActions(renderer, renderActions);

        const { renderedElements, error } = pipe(
            renderedElementsE,
            E.fold(
                e => ({
                    renderedElements: chatState.renderedElements
                    , error: e.description
                }),
                rs => ({ renderedElements: rs, error: undefined }),
            ))


        const actionHandler = scheme.getActionHandler(renderedElements);

        return {
            ...chatState,
            error,
            actionHandler,
            renderedElements
        };
    }

export const genericRenderComponent = <
    Props,
    RootComponent extends ComponentElement,
    ContextReqs extends ComponentReqs<RootComponent>,
    // ContextReqs,
    // CompEls,
    CompEls,
    State,
    HandlerReturn,
    // HandlerReturn,
    // TypeAssert extends If<CompEls, Els, {}, never> = If<CompEls, Els, {}, never>
    >(
        scheme: RenderScheme<CompEls, HandlerReturn>,
        source: RenderSource<
            Props,
            RootComponent,
            ContextReqs, State, HandlerReturn>) => {

    return (chatState: ChatState<State, HandlerReturn>) => {

        console.log('genericRenderComponent');

        const { elements, treeState, removedElements, newElements } =
            createElements(
                source.component,
                source.contextCreator(chatState),
                source.props,
                chatState.treeState
            )

        console.log('newElements');
        console.log(newElements);

        console.log('removedElements');
        console.log(removedElements);

        const draft = scheme.createDraft(elements);

        const els = scheme.getEffects(removedElements, newElements)

        console.log('els');
        console.log(els);

        const effects =
            scheme.getEffects(removedElements, newElements)

        const inputHandler = scheme.getInputHandler(draft);

        const renderActions = createRenderActions(chatState.renderedElements, draft.messages);
        const nextChatState = {
            ...chatState,
            treeState,
            inputHandler,
        }

        return {
            effects: [...effects, ...draft.effects],
            chatdata: nextChatState,
            renderFunction: renderFunction<State, HandlerReturn, CompEls>(
                renderActions, nextChatState, scheme
            )
        };
    };
};

// export const renderComponent = genericRenderComponent();


export interface InitializedApp<R, H, E> {
    app: Required<Application<R, H, E>>,
    chatdata: ChatState<R, H>,
    renderer: ChatRenderer
}

export type InitializedAppFor<C> =
    C extends Application<infer R, infer H, infer E>
    ? InitializedApp<R, H, E> : never

export type ApplicationFor<C> =
    C extends InitializedApp<infer R, infer H, infer E>
    ? Application<R, H, E> : never

export type AppStateOf<C> =
    C extends Application<infer R, infer H, infer E>
    ? ChatState<R, H> : never

export type AppActionsOf<C> =
    C extends Application<infer R, infer H, infer E>
    ? H : never

export type AppEventsOf<C> =
    C extends Application<infer R, infer H, infer E>
    ? E : never


// <TypeAssert extends If<{}, E, never, {}> = If<{}, E, never, {}>>
export function initApplication<R, H, E>(app: Application<R, H, E>) {
    return async (ctx: TelegrafContext): Promise<InitializedApp<R, H, E>> => {
        const { chatdata } = app.renderFunc(await app.chatStateFactory(ctx))

        return {
            app: {
                ...app,
                handleAction: app.handleAction ?? defaultHandleAction(),
                renderer: (app.renderer ?? createChatRenderer),
                init: app.init ?? CA.doNothing,
                // handleEvent: app.handleEvent ?? (async (ctx, e: {}) => ctx.chatdata),
                queueStrategy: app.queueStrategy ?? (() => { })
            },
            renderer: (app.renderer ?? createChatRenderer)(ctx),
            chatdata,
        }
    }
}

export function createQueuedChatHandler<R, H, E>(
    { app, chatdata, renderer }: InitializedApp<R, H, E>
): QueuedChatHandler<ChatState<R, H>, E> {
    return new QueuedChatHandler<ChatState<R, H>, E>(chat => ({
        chatdata,
        handleAction: async (self, ctx) => {
            self.setChatData(
                self,
                await app.handleAction(
                    { app, tctx: ctx, renderer, queue: chat, chatdata: self.chatdata }
                ))
        },
        handleMessage: async (self, ctx) => {
            mylog(`QueuedChatHandler.chat: ${ctx.message?.text} ${ctx.message?.message_id}`);

            self.setChatData(
                self,
                await app.handleMessage!(
                    { app, tctx: ctx, renderer, queue: chat, chatdata: self.chatdata }
                ))
            mylog(`QueuedChatHandler.chat done ${ctx.message?.message_id}}`)

        },
        handleEvent: async (self, ctx, event: E) => {
            mylog(`handleEvent: ${event}`);

            if (app.handleEvent)
                self.setChatData(
                    self,
                    await app.handleEvent(
                        { app, tctx: ctx, renderer, queue: chat, chatdata: self.chatdata },
                        event
                    )
                )
        },
        setChatData: (self, d) => {
            // mylog(self.chatdata.treeState.nextStateTree?.state)
            self.chatdata = d
            // mylog(self.chatdata.treeState.nextStateTree?.state)
        }
    }), true)
}

export const createOpaqueChatHandler = <R, H, E>(app: Application<R, H, E>) =>
    async (ctx: TelegrafContext): Promise<OpaqueChatHandler<E>> => {
        const a = await initApplication(app)(ctx)
        const chat = createQueuedChatHandler(a)

        if (app.init) {
            chat._chat.setChatData(
                chat._chat,
                await app.init({
                    app,
                    tctx: ctx,
                    renderer: a.renderer,
                    queue: chat,
                    chatdata: a.chatdata
                })
            )
        }

        chat.busy = false
        return chat
    }

export const createChatHandlerFactory = <R, H, E>(app: Application<R, H, E>)
    : ChatHandlerFactory<OpaqueChatHandler<E>, E> =>
    createOpaqueChatHandler(app)