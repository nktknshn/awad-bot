import { identity } from "fp-ts/lib/function"
import { Store } from "redux"
import { TelegrafContext } from "telegraf/typings/context"
import { ChatRenderer, createChatRenderer } from "./chatrenderer"
import { ChatHandlerFactory } from "./chatsdispatcher"
import { ComponentElement } from "./component"
import { defaultCreateDraft, RenderDraft } from "./elements-to-messages"
import { defaultH, defaultHandleAction, defaultHandler } from "./handler"
import { mylog } from "./logging"
import { Actions, createRenderActions } from "./render-actions"
import { RenderedElement } from "./rendered-messages"
import { ElementsTree, TreeState } from "./tree"
import { AppReqs, GetAllBasics } from "./types-util"
import { draftToInputHandler, renderActions, renderedElementsToActionHandler } from "./ui"

export interface ChatHandler<R> {
    chatdata: R,
    handleMessage(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleAction(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleEvent(self: ChatHandler<R>, ctx: TelegrafContext, data: string, d?: (a: R) => R): Promise<unknown>
}

export interface ChatHandler2<R> {
    handleMessage(ctx: TelegrafContext): Promise<unknown>
    handleAction(ctx: TelegrafContext): Promise<unknown>
    handleEvent(ctx: TelegrafContext, data: string, d?: (a: R) => R): Promise<void>
}

export interface ChatS<R> {
    handleEvent(ctx: TelegrafContext, data: string, d?: (a: R) => R): Promise<unknown>
}


type IncomingItem = IncomingMessage | IncomingAction | IncomingEvent<any>

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

class IncomingEvent<R> {
    kind: 'IncomingEvent' = 'IncomingEvent'
    constructor(readonly ctx: TelegrafContext, public readonly typ: string, public readonly d?: R) {

    }
}

export class QueuedChatHandler<R> implements ChatHandler2<R> {
    incomingQueue: IncomingItem[] = []
    busy = false

    _chat: ChatHandler<R>

    constructor(readonly chat: ((t: QueuedChatHandler<R>) => ChatHandler<R>)) {

        this._chat = chat(this)
    }

    async push(item: IncomingItem) {

        if (this.busy) {
            mylog(`busy so item was queued ${item.kind}`);

            this.incomingQueue.push(item)
        } else {
            mylog(`processing ${item.kind}`);
            await this.processItem(item)
            mylog(`done ${item.kind}`);

            mylog(`queue has ${this.incomingQueue.length} elements ${this.incomingQueue.map(_ => _.kind).join()}`)

            while (this.incomingQueue.length) {
                const nextItem = this.incomingQueue.shift()
                await this.processItem(nextItem!)
                this.busy = true
            }

            mylog(`queue finished`)
            this.busy = false
        }
    }

    async processItem(item: IncomingItem) {
        this.busy = true
        mylog(`processItem: ${item.kind}`)

        if (item.kind === 'IncomingMessage') {
            await this._chat.handleMessage(this._chat, item.ctx)
        }
        else if (item.kind === 'IncomingAction') {
            await this._chat.handleAction(this._chat, item.ctx)
        }
        else if (item.kind === 'IncomingEvent') {
            await this._chat.handleEvent(this._chat, item.ctx, item.typ, item.d)
        }
        mylog(`done processItem: ${item.kind}`)
        this.busy = false
    }

    async handleAction(ctx: TelegrafContext) {
        await this.push(new IncomingAction(ctx))
    }

    async handleMessage(ctx: TelegrafContext) {
        await this.push(new IncomingMessage(ctx))
    }

    async handleEvent<R>(ctx: TelegrafContext, data: string, d?: R) {
        await this.push(new IncomingEvent<R>(ctx, data, d))
    }
}


export type ChatState<R, H> = {
    treeState: TreeState,
    renderedElements: RenderedElement[],
    inputHandler?: (ctx: TelegrafContext) => H,
    actionHandler?: (ctx: TelegrafContext) => H
} & R

export const emptyChatState = <R, H>(): ChatState<{}, H> => ({
    treeState: {},
    renderedElements: [],
    // inputHandler: function (a) { return identity },
    // actionHandler: function (a) { return identity },
})


export interface Application<C, H> {
    renderer?: (ctx: TelegrafContext) => ChatRenderer,
    renderFunc: (s: C) => readonly [{
        draft: RenderDraft,
        treeState: TreeState,
        inputHandler: (ctx: TelegrafContext) => H
    }, (renderer: ChatRenderer) => Promise<C>],
    init?: (ctx: TelegrafContext, renderer: ChatRenderer, chat: ChatHandler2<C>, chatdata: C) => Promise<any>,
    handleMessage: (
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<C>,
        chatdata: C,
    ) => Promise<any>,
    handleAction?: (
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<C>,
        chatdata: C,
    ) => Promise<any>,
    chatData: () => C
}

export function getApp<R, H>(app: Application<ChatState<R, H>, H>): Application<ChatState<R, H>, H> {
    return app
}

export const createChatHandlerFactory = <R, H>(app: Application<ChatState<R, H>, H>)
    : ChatHandlerFactory<ChatHandler2<ChatState<R, H>>, ChatState<R, H>> =>
    async ctx => {
        mylog("createChatHandlerFactory");

        const renderer = (app.renderer ?? createChatRenderer)(ctx)

        const onStateUpdated = (chatState: ChatState<R, H>) => (src: string) => async () => {
            mylog(`onStateUpdated by ${src}`);
            // mylog(chatState);
            const [{ draft, treeState }, render] = app.renderFunc(chatState)

            for (const e of draft.effects) {
                await e.element.callback()
            }

            return await render(renderer)
        }

        // const chatdata = app.chatData ? app.chatData() : emptyChatState()
        const chatdata = app.chatData()

        const chat = new QueuedChatHandler<ChatState<R, H>>(t => ({
            chatdata,
            handleAction: async (self, ctx) => {
                return (app.handleAction ?? defaultHandleAction)(ctx, renderer, t, self.chatdata)
            },
            handleMessage: async (self, ctx) => {
                mylog(`QueuedChatHandler.chat: ${ctx.message?.text} ${ctx.message?.message_id}`);
                return app.handleMessage(ctx, renderer, t, self.chatdata)
            },
            handleEvent: async (self, ctx: TelegrafContext, typ: string, f) => {
                mylog(`handleEvent: ${typ} ${f}`);

                if (typ == 'updated') {
                    self.chatdata = await onStateUpdated(f ? f(self.chatdata) : self.chatdata)("handleEvent")()
                }
            }
        }))

        const [{ inputHandler, treeState }, _] = app.renderFunc(chatdata)
        chatdata.inputHandler = inputHandler
        chatdata.treeState = treeState

        app.init && await app.init(ctx, renderer, chat, chatdata)

        return chat
    }


interface InputHandlerF<R> {
    (ctx: TelegrafContext): R
}

interface RenderScheme<
    RootComponent extends ComponentElement,
    RootReqs extends AppReqs<RootComponent>,
    Els extends GetAllBasics<RootComponent>,
    Rdr extends RenderDraft,
    HandlerReturn
    > {
    createDraft: (els: Els[]) => Rdr,
    getInputHandler: (draft: Rdr) => InputHandlerF<HandlerReturn>,

}


export const genericRenderFunction = <
    Props,
    RootComponent extends ComponentElement,
    ContextReqs extends AppReqs<RootComponent>,
    Els extends GetAllBasics<RootComponent>,
    Ctx,
    Rdr extends RenderDraft,
    HandlerReturn
>
    (
        app: (props: Props) => RootComponent,
        props: Props,
        gc: (c: Ctx) => ContextReqs,
        createDraft: ((els: Els[]) => Rdr),
        draftToInputHandler: (draft: Rdr) => InputHandlerF<HandlerReturn>
    ) =>
    (chatState: ChatState<Ctx, HandlerReturn>): readonly [{
        draft: Rdr,
        treeState: TreeState,
        inputHandler: InputHandlerF<HandlerReturn>,
        actions: Actions[]
    }, (renderer: ChatRenderer) => Promise<ChatState<Ctx, HandlerReturn>>] => {

        const [els, treeState] = ElementsTree.createElements(app, gc(chatState), props, chatState.treeState)

        const draft = createDraft(els)
        const inputHandler = draftToInputHandler(draft)
        const actions = createRenderActions(chatState.renderedElements, draft.messages)

        return [
            { draft, treeState, inputHandler, actions },
            async (renderer: ChatRenderer): Promise<ChatState<Ctx, HandlerReturn>> => {
                const renderedElements = await renderActions(renderer, actions)
                const actionHandler = renderedElementsToActionHandler(renderedElements)

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
