import * as A from 'fp-ts/lib/Array';
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import { createElements, TreeState } from 'Libtree2';
import { Store } from "redux";
import { TelegrafContext } from "telegraf/typings/context";
import { PhotoGroupElement } from "../bot3/mediagroup";
import { parseFromContext } from './bot-util';
import { AppChatAction, ChatActionContext } from "./chatactions";
import { ChatRenderer } from "./chatrenderer";
import { ComponentElement } from "./component";
import { createDraftWithImages, Effect } from "./draft";
import { BasicElement, EffectElement } from "./elements";
import { RenderDraft } from "./elements-to-messages";
import { chainInputHandlers, contextOpt, findRepliedTo } from './inputhandler';
import { mylog } from "./logging";
import { createRenderActions } from "./render-actions";
import { BotMessage, RenderedElement } from "./rendered-messages";
// import { ElementsTree, TreeState } from "./tree";
import { AppActionsFlatten, AppReqs, GetAllBasics, If, IfDef } from "./types-util";
import { renderActions as applyRenderActions } from "./ui";
import { RenderedUserMessage, UserMessageElement } from "./usermessage";

export type ChatState<R, H> = {
    readonly renderedElements: RenderedElement[];
    readonly treeState?: TreeState;
    readonly inputHandler?: (ctx: TelegrafContext) => (H | undefined);
    readonly actionHandler?: (ctx: TelegrafContext) => H;
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
            O.chain(callbackTo => pipe(action, O.map(action => ({ action, callbackTo })))),
            O.chainNullableK(({ callbackTo, action }) => callbackTo.input.callback2<A>(action))
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

export interface Application<R, H, E> {
    chatStateFactory: (ctx: TelegrafContext) => ChatState<R, H>;
    renderer?: (ctx: TelegrafContext) => ChatRenderer;
    renderFunc: (state: ChatState<R, H>) => {
        chatdata: ChatState<R, H>;
        renderFunction: (renderer: ChatRenderer) => Promise<ChatState<R, H>>;
        effects: Effect<H>[]
    };
    init?: AppChatAction<R, H, E>;
    handleMessage: AppChatAction<R, H, E>;
    handleAction?: AppChatAction<R, H, E>;
    handleEvent?: (
        ctx: ChatActionContext<R, H, E>,
        event: E
    ) => Promise<ChatState<R, H>>;
    queueStrategy?: () => void;
    actionReducer: (a: H | H[]) => AppChatAction<R, H, E>[];
}

export function getApp<R = {}, H = never, E = {},
    NeverNever extends IfDef<H, {}, never> = IfDef<H, {}, never>>(
        app: Application<R, H, E> & NeverNever
    ): Application<R, H, E> {
    return app;
}

interface RenderSource<Props, RootComponent extends ComponentElement, ContextReqs extends AppReqs<RootComponent>, R, H> {
    component: (props: Props) => RootComponent;
    props: Props;
    contextCreator: (c: ChatState<R, H>) => ContextReqs;
}

export function fromSource<
    Props,
    RootComponent extends ComponentElement,
    ContextReqs extends AppReqs<RootComponent>,
    R, H
>(src: RenderSource<Props, RootComponent, ContextReqs, R, H>) {
    return src;
}

interface RenderScheme<Els> {
    createDraft: <H>(els: Els[]) => RenderDraft<H>;
    getInputHandler: <H>(draft: RenderDraft<H>) => (ctx: TelegrafContext) => H | undefined;
    getActionHandler: <A>(rs: RenderedElement[]) => (ctx: TelegrafContext) => A | undefined;
    getEffects: (removedElements: Els[], newElements: Els[]) => Els[]
}

function getScheme<Els>(s: RenderScheme<Els>) {
    return s;
}

export const defaultRenderScheme = getScheme({
    createDraft: createDraftWithImages,
    getInputHandler,
    getActionHandler,
    getEffects: (removedElements, newElements) => [
        ...removedElements.filter((_): _ is EffectElement<any> =>
            _.kind === 'EffectElement' && _.type === 'OnRemoved'),
        ...newElements.filter((_): _ is EffectElement<any> =>
            _.kind === 'EffectElement' && _.type === 'OnCreated'),
    ]
});

export const genericRenderComponent = <Els>(scheme: RenderScheme<Els>) => {
    return <
        Props,
        RootComponent extends ComponentElement,
        ContextReqs extends AppReqs<RootComponent>,
        CompEls extends GetAllBasics<RootComponent>,
        Ctx,
        HandlerReturn extends AppActionsFlatten<RootComponent>,
        TypeAssert extends If<CompEls, Els, {}, never> = If<CompEls, Els, {}, never>
    >(source: RenderSource<
        Props,
        RootComponent,
        ContextReqs, Ctx, HandlerReturn> & TypeAssert) => {

        return (chatState: ChatState<Ctx, HandlerReturn>) => {

            const { elements, treeState, removedElements, newElements } = createElements(
                source.component,
                source.contextCreator(chatState),
                source.props,
                chatState.treeState
            );

            const draft = scheme.createDraft<HandlerReturn>(elements);

            const { effects } = scheme.createDraft<HandlerReturn>(
                scheme.getEffects(removedElements, newElements)
            )

            const inputHandler = scheme.getInputHandler(draft);

            const renderActions = createRenderActions(chatState.renderedElements, draft.messages);

            return {
                effects: [...effects, ...draft.effects],
                chatdata: {
                    ...chatState,
                    treeState,
                    inputHandler,
                },
                renderFunction: async (renderer: ChatRenderer): Promise<ChatState<Ctx, HandlerReturn>> => {
                    const renderedElements = await applyRenderActions(renderer, renderActions);
                    const actionHandler = scheme.getActionHandler(renderedElements);

                    mylog("renderedElements");
                    mylog(JSON.stringify(renderedElements));

                    return {
                        ...chatState,
                        treeState,
                        inputHandler,
                        actionHandler,
                        renderedElements
                    };
                }
            };
        };
    };
};

export const renderComponent = genericRenderComponent(defaultRenderScheme);

export const storeWithDispatcher = <S extends Store, D>(store: S, storeToDispatch: (s: S) => D) => {
    return () => ({
        ...store.getState(),
        dispatcher: storeToDispatch(store)
    });
};
