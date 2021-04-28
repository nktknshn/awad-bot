import { identity } from "fp-ts/lib/function"
import { Store } from "redux"
import { TelegrafContext } from "telegraf/typings/context"
import { ChatRenderer, createChatRenderer } from "./chatrenderer"
import { ChatHandlerFactory } from "./chatsdispatcher"
import { ComponentElement } from "./component"
import { defaultCreateDraft, RenderDraft } from "./elements-to-messages"
import { mylog } from "./logging"
import { Actions, createRenderActions } from "./render-actions"
import { RenderedElement } from "./rendered-messages"
import { ElementsTree, TreeState } from "./tree"
import { AppActions, AppActionsFlatten, AppReqs, GetAllBasics } from "./types-util"
import { draftToInputHandler, renderActions as applyRenderActions, renderedElementsToActionHandler } from "./ui"
import * as A from 'fp-ts/lib/Array';
import { pipe } from "fp-ts/lib/pipeable"
import * as O from 'fp-ts/lib/Option';
import { StateAction } from "./handlerF"
import { AppChatAction, ChatActionContext, chatState } from "./chatactions"
import { defaultActionToChatAction } from "./reducer"
import { getInputHandler as getInputHandlerImpl, getActionHandler as getActionHandlerImpl } from "./inputhandler"
import { createDraftWithImages } from "./draft"
import { BasicElement } from "./elements"
import { PhotoGroupElement } from "../bot3/mediagroup"
import { RenderedUserMessage, UserMessageElement } from "./usermessage"


export interface ChatHandler<R, E = any> {
    chatdata: R,
    handleMessage(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleAction(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleEvent(self: ChatHandler<R>, ctx: TelegrafContext, event: E): Promise<unknown>
    setChatData(self: ChatHandler<R>, d: R): void
}

export interface ChatHandler2<E = any> {
    handleMessage(ctx: TelegrafContext): Promise<unknown>
    handleAction(ctx: TelegrafContext): Promise<unknown>
    handleEvent(ctx: TelegrafContext, event: E): Promise<unknown>
}

type IncomingItem = IncomingMessage | IncomingAction | IncomingEvent<unknown>

class IncomingMessage {
    kind: 'IncomingMessage' = 'IncomingMessage'
    constructor(readonly ctx: TelegrafContext) {

    }
}

class IncomingAction {
    kind: 'IncomingAction' = 'IncomingAction'
    constructor(readonly ctx: TelegrafContext) {

    }
}

class IncomingEvent<E> {
    kind: 'IncomingEvent' = 'IncomingEvent'
    constructor(public readonly ctx: TelegrafContext, public readonly event: E) {

    }
}

export class QueuedChatHandler<R, E = unknown> implements ChatHandler2<E> {
    incomingQueue: IncomingItem[] = []

    busy = false
    currentItem?: IncomingItem

    rerender = false
    _chat: ChatHandler<R, E>

    constructor(readonly chat: ((t: QueuedChatHandler<R>) => ChatHandler<R>)) {

        this._chat = chat(this)
    }

    async push(item: IncomingItem) {

        if (this.busy) {
            mylog(`busy so item was queued ${item.kind}`);
            this.incomingQueue.push(item)
        } else {
            mylog(`processing ${item.kind}  ${item.kind !== 'IncomingEvent' && item.ctx.message?.message_id}`);

            await this.processItem(item)

            mylog(`done ${item.kind} ${item.kind !== 'IncomingEvent' && item.ctx.message?.message_id}`);
            mylog(`queue has ${this.incomingQueue.length} elements ${this.incomingQueue.map(_ => _.kind).join()}`)

            while (this.incomingQueue.length) {
                const nextItem = this.incomingQueue.shift()

                await this.processItem(nextItem!)
                // this.busy = true
            }

            mylog(`queue finished`)
            this.busy = false


            // if (this.rerender) {
            //     await this.processItem(new IncomingEvent("render"))
            //     this.rerender = false
            // }

        }
    }

    async processItem(item: IncomingItem) {
        this.busy = true
        this.currentItem = item

        mylog(`processItem: ${item.kind} ${item}`)

        if (item.kind === 'IncomingMessage') {
            await this._chat.handleMessage(this._chat, item.ctx)
        }
        else if (item.kind === 'IncomingAction') {
            await this._chat.handleAction(this._chat, item.ctx)
        }
        else if (item.kind === 'IncomingEvent') {
            await this._chat.handleEvent(this._chat, item.ctx, item.event as E)
        }

        mylog(`done processItem: ${item.kind}`)

        this.currentItem = undefined
        this.busy = false
    }

    async handleAction(ctx: TelegrafContext) {
        mylog(`handleAction: ${ctx.message?.message_id}`)
        await this.push(new IncomingAction(ctx))
    }

    async handleMessage(ctx: TelegrafContext) {
        mylog(`handleMessage: ${ctx.message?.message_id}`)
        await this.push(new IncomingMessage(ctx))
    }

    async handleEvent<E>(ctx: TelegrafContext, event: E) {
        // mylog(`handleEvent: ${ctx.message?.message_id}`)
        await this.push(new IncomingEvent<E>(ctx, event))
    }
}


export type ChatState<R, H> = {
    treeState: TreeState,
    renderedElements: RenderedElement[],
    inputHandler?: (ctx: TelegrafContext) => (H | undefined),
    actionHandler?: (ctx: TelegrafContext) => H,
    // state: R
} & R

export const getUserMessages = <R, H>(c: ChatState<R, H>): number[] => {
    return A.flatten(c.renderedElements.filter((_): _ is RenderedUserMessage => _.kind === 'RenderedUserMessage')
        .map(_ => _.outputIds()))
}

export const createChatState = <R, H>(r: R): ChatState<R, H> => ({
    treeState: {},
    renderedElements: [],
    ...r
})

export interface Application<R, H, E> {
    chatDataFactory: (ctx: TelegrafContext) => ChatState<R, H>,
    renderer?: (ctx: TelegrafContext) => ChatRenderer,
    renderFunc: (s: ChatState<R, H>) => {
        chatState: ChatState<R, H>,
        renderFunction: (renderer: ChatRenderer) => Promise<ChatState<R, H>>
    },
    init?: AppChatAction<R, H, E>,
    handleMessage: AppChatAction<R, H, E>,
    handleAction?: AppChatAction<R, H, E>,
    handleEvent?: (
        ctx: ChatActionContext<R, H, E>,
        event: E
    ) => Promise<ChatState<R, H>>,
    queueStrategy?: () => void,
    actionReducer: (a: H | H[]) => AppChatAction<R, H, E>[]
}

export function getApp<R = {}, H = never, E = {}>(
    app: Application<R, H, E>
): Application<R, H, E> {
    return app
}

export const createChatHandlerFactory = <R, H, E>(app: Application<R, H, E>)
    : ChatHandlerFactory<ChatHandler2<E>, E> =>
    async ctx => {
        mylog("createChatHandlerFactory");

        const renderer = (app.renderer ?? createChatRenderer)(ctx)
        const chatdata = app.chatDataFactory(ctx)

        const { chatState: { inputHandler, treeState }, renderFunction } = app.renderFunc(chatdata)

        chatdata.inputHandler = inputHandler
        chatdata.treeState = treeState

        const queue = new QueuedChatHandler<ChatState<R, H>, E>(t => ({
            chatdata,
            handleAction: async (self, ctx) => {
                self.setChatData(
                    self,
                    await app.handleAction!(
                        { app, tctx: ctx, renderer, chat: t, chatdata: self.chatdata }
                    ))
            },
            handleMessage: async (self, ctx) => {
                mylog(`QueuedChatHandler.chat: ${ctx.message?.text} ${ctx.message?.message_id}`);

                self.setChatData(
                    self,
                    await app.handleMessage!(
                        { app, tctx: ctx, renderer, chat: t, chatdata: self.chatdata }
                    ))
                mylog(`QueuedChatHandler.chat done ${ctx.message?.message_id}}`)

            },
            handleEvent: async (self, ctx, event: E) => {
                mylog(`handleEvent: ${event}`);

                if (app.handleEvent)
                    self.setChatData(
                        self,
                        await app.handleEvent(
                            { app, tctx: ctx, renderer, chat: t, chatdata: self.chatdata },
                            event
                        )
                    )
            },
            setChatData: (self, d) => {
                // mylog(self.chatdata.treeState.nextStateTree?.state)
                self.chatdata = d
                // mylog(self.chatdata.treeState.nextStateTree?.state)
            }
        }))

        if (app.init) {
            const cd = await app.init({ app, tctx: ctx, renderer, chat: queue, chatdata })
        }

        return queue
    }


export interface InputHandlerF<R> {
    (ctx: TelegrafContext): R
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

type DefaultEls = BasicElement | PhotoGroupElement | UserMessageElement

interface RenderSource<Props, RootComponent extends ComponentElement, ContextReqs extends AppReqs<RootComponent>, R, H> {
    component: (props: Props) => RootComponent,
    props: Props,
    contextCreator: (c: ChatState<R, H>) => ContextReqs
}

export function fromSource<Props, RootComponent extends ComponentElement, ContextReqs extends AppReqs<RootComponent>, R, H>
    (src: RenderSource<Props, RootComponent, ContextReqs, R, H>) {
    return src
}

export const defaultRenderFunction = <
    Props,
    RootComponent extends ComponentElement,
    ContextReqs extends AppReqs<RootComponent>,
    Ctx,
    HandlerReturn extends AppActionsFlatten<RootComponent>,
    Draft extends RenderDraft<HandlerReturn>,
    Simple extends
    If<GetAllBasics<RootComponent>, DefaultEls, {}, never>
    = If<GetAllBasics<RootComponent>, DefaultEls, {}, never>
>
    (
        app: (props: Props) => RootComponent,
        props: Props & Simple,
        gc: (c: ChatState<Ctx, HandlerReturn>) => ContextReqs
    ) => createRenderFunction<
        Props,
        RootComponent,
        ContextReqs,
        GetAllBasics<RootComponent>,
        Ctx,
        Draft,
        HandlerReturn
    >(app, props, gc, createDraftWithImages as (els: DefaultEls[]) => Draft,
        getInputHandlerImpl as (draft: Draft) => InputHandlerF<HandlerReturn | undefined>, getActionHandlerImpl
    )


interface RenderScheme<
    Els,
    > {
    createDraft: <H>(els: Els[]) => RenderDraft<H>,
    getInputHandler:
    <H>(draft: RenderDraft<H>) => (ctx: TelegrafContext) => H | undefined,
    getActionHandler: <A>(rs: RenderedElement[]) => (ctx: TelegrafContext) => A | undefined
}

function getScheme<Els>(s: RenderScheme<Els>) {
    return s
}

export const defaultRenderScheme = getScheme({
    createDraft: createDraftWithImages,
    getInputHandler: getInputHandlerImpl,
    getActionHandler: getActionHandlerImpl
})


export const func2 = <
    Els
>(scheme: RenderScheme<Els>) => {
    return <
        Props,
        RootComponent extends ComponentElement,
        ContextReqs extends AppReqs<RootComponent>,
        CompEls extends GetAllBasics<RootComponent>,
        Ctx,
        HandlerReturn extends AppActionsFlatten<RootComponent>,
        TypeAssert extends If<CompEls, Els, {}, never> = If<CompEls, Els, {}, never>
    >(source: RenderSource<Props, RootComponent, ContextReqs, Ctx, HandlerReturn> & TypeAssert) => {

        return (chatState: ChatState<Ctx, HandlerReturn>) => {
            const [els, treeState] = ElementsTree.createElements(source.component, source.contextCreator(chatState), source.props, chatState.treeState)

            const draft = scheme.createDraft<HandlerReturn>(els)
            const inputHandler = scheme.getInputHandler(draft)
            const renderActions = createRenderActions(chatState.renderedElements, draft.messages)

            return {
                chatState: {
                    ...chatState,
                    treeState,
                    inputHandler,
                },
                renderFunction: async (renderer: ChatRenderer): Promise<ChatState<Ctx, HandlerReturn>> => {
                    const renderedElements = await applyRenderActions(renderer, renderActions)
                    const actionHandler = scheme.getActionHandler(renderedElements)

                    mylog("renderedElements");
                    mylog(JSON.stringify(renderedElements));

                    return {
                        ...chatState,
                        treeState,
                        inputHandler,
                        actionHandler,
                        renderedElements
                    }
                }
            }
        }
    }
}

export const renderComponent = func2(defaultRenderScheme)

export const createRenderFunction = <
    Props,
    RootComponent extends ComponentElement,
    ContextReqs extends AppReqs<RootComponent>,
    Els extends GetAllBasics<RootComponent>,
    Ctx,
    Draft extends RenderDraft<HandlerReturn>,
    HandlerReturn extends AppActionsFlatten<RootComponent>
>
    (
        app: (props: Props) => RootComponent,
        props: Props,
        gc: (c: ChatState<Ctx, HandlerReturn>) => ContextReqs,
        createDraft: ((els: Els[]) => Draft),
        getInputHandler: (draft: Draft) => InputHandlerF<HandlerReturn | undefined> =
            getInputHandlerImpl as (draft: Draft) => InputHandlerF<HandlerReturn | undefined>,
        getActionHandler: (rs: RenderedElement[]) => (ctx: TelegrafContext) => (HandlerReturn | undefined) =
            getActionHandlerImpl
    ) =>
    (chatState: ChatState<Ctx, HandlerReturn>): readonly [{
        draft: Draft,
        treeState: TreeState,
        inputHandler: InputHandlerF<HandlerReturn | undefined>,
        renderActions: Actions[],
        effectsActions: HandlerReturn[]
    }, (renderer: ChatRenderer) => Promise<ChatState<Ctx, HandlerReturn>>] => {

        const [els, treeState] = ElementsTree.createElements(app, gc(chatState), props, chatState.treeState)

        const draft = createDraft(els)
        const effects = draft.effects
        const effectsActions = effects.map(_ => _.element.callback())

        const inputHandler = getInputHandler(draft)
        const renderActions = createRenderActions(chatState.renderedElements, draft.messages)

        return [
            { draft, treeState, inputHandler, renderActions, effectsActions },
            async (renderer: ChatRenderer): Promise<ChatState<Ctx, HandlerReturn>> => {
                const renderedElements = await applyRenderActions(renderer, renderActions)
                const actionHandler = getActionHandler(renderedElements)

                mylog("renderedElements");
                mylog(JSON.stringify(renderedElements));

                return {
                    ...chatState,
                    treeState,
                    inputHandler,
                    actionHandler,
                    renderedElements
                }
            }
        ] as const
    }

export const storeWithDispatcher = <S extends Store, D>(store: S, storeToDispatch: (s: S) => D) => {
    return () => ({
        ...store.getState(),
        dispatcher: storeToDispatch(store)
    })
}
