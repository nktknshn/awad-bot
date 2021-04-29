import * as A from 'fp-ts/lib/Array';
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import { Store } from "redux";
import { TelegrafContext } from "telegraf/typings/context";
import { PhotoGroupElement } from "../bot3/mediagroup";
import { parseFromContext } from './bot-util';
import { AppChatAction, ChatActionContext } from "./chatactions";
import { ChatRenderer } from "./chatrenderer";
import { ComponentElement } from "./component";
import { createDraftWithImages, Effect } from "./draft";
import { BasicElement } from "./elements";
import { RenderDraft } from "./elements-to-messages";
import { chainInputHandlers, contextOpt, findRepliedTo } from './inputhandler';
import { mylog } from "./logging";
import { createRenderActions } from "./render-actions";
import { BotMessage, RenderedElement } from "./rendered-messages";
import { ElementsTree, TreeState } from "./tree";
import { AppActionsFlatten, AppReqs, GetAllBasics } from "./types-util";
import { renderActions as applyRenderActions } from "./ui";
import { RenderedUserMessage, UserMessageElement } from "./usermessage";

export type ChatState<R, H> = {
    treeState: TreeState;
    renderedElements: RenderedElement[];
    inputHandler?: (ctx: TelegrafContext) => (H | undefined);
    actionHandler?: (ctx: TelegrafContext) => H;
} & R;


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
    treeState: {},
    renderedElements: [],
    ...r
});

export interface Application<R, H, E> {
    chatDataFactory: (ctx: TelegrafContext) => ChatState<R, H>;
    renderer?: (ctx: TelegrafContext) => ChatRenderer;
    renderFunc: (s: ChatState<R, H>) => {
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

export function getApp<R = {}, H = never, E = {}>(
    app: Application<R, H, E>
): Application<R, H, E> {
    return app;
}

export interface InputHandlerF<R> {
    (ctx: TelegrafContext): R;
}
/**
 * Conditional: if `T` extends `U`, then returns `True` type, otherwise `False` type
 */
export type If<T, U, True, False> = [T] extends [U] ? True : False;
/**
 * If `T` is defined (not `never`), then resulting type is equivalent to `True`, otherwise to `False`.
 */

export type IfDef<T, True, False> = If<T, never, False, True>;
/**
 * If `MaybeNever` type is `never`, then a `Fallback` is returned. Otherwise `MaybeNever` type is returned as is.
 */

export type OrElse<MaybeNever, Fallback> = IfDef<MaybeNever, MaybeNever, Fallback>;
type DefaultEls = BasicElement | PhotoGroupElement | UserMessageElement;
interface RenderSource<Props, RootComponent extends ComponentElement, ContextReqs extends AppReqs<RootComponent>, R, H> {
    component: (props: Props) => RootComponent;
    props: Props;
    contextCreator: (c: ChatState<R, H>) => ContextReqs;
}

export function fromSource<Props, RootComponent extends ComponentElement, ContextReqs extends AppReqs<RootComponent>, R, H>(src: RenderSource<Props, RootComponent, ContextReqs, R, H>) {
    return src;
}
interface RenderScheme<
    Els
    > {
    createDraft: <H>(els: Els[]) => RenderDraft<H>;
    getInputHandler: <H>(draft: RenderDraft<H>) => (ctx: TelegrafContext) => H | undefined;
    getActionHandler: <A>(rs: RenderedElement[]) => (ctx: TelegrafContext) => A | undefined;
}
function getScheme<Els>(s: RenderScheme<Els>) {
    return s;
}

export const defaultRenderScheme = getScheme({
    createDraft: createDraftWithImages,
    getInputHandler,
    getActionHandler
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
    >(source: RenderSource<Props, RootComponent, ContextReqs, Ctx, HandlerReturn> & TypeAssert) => {
        console.log(scheme);

        return (chatState: ChatState<Ctx, HandlerReturn>) => {

                ElementsTree.createElements(source.component, source.contextCreator(chatState), source.props, chatState.treeState);

            const [els, treeState] = ElementsTree.createElements(source.component, source.contextCreator(chatState), source.props, chatState.treeState);

            const draft = scheme.createDraft<HandlerReturn>(els);

            const inputHandler = scheme.getInputHandler(draft);
            const renderActions = createRenderActions(chatState.renderedElements, draft.messages);
            
            const effects = draft.effects

            return {
                effects,
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
