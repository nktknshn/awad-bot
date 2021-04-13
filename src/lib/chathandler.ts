import { TelegrafContext } from "telegraf/typings/context"
import { ChatRenderer } from "./chatrenderer"
import { ChatHandlerFactory } from "./chatsdispatcher"
import { ComponentElement } from "./elements"
import { defaultCreateDraft, RenderDraft } from "./elements-to-messages"
import { createRenderActions } from "./render-actions"
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
    handleEvent(ctx: TelegrafContext, data: string, d?: (a: R) => R): Promise<unknown>
}

export interface ChatS<R>{
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

    constructor(readonly chat:( (t: QueuedChatHandler<R>) => ChatHandler<R>)) { 

        this._chat = chat(this)
    }


    async push(item: IncomingItem) {

        if (this.busy) {
            this.incomingQueue.push(item)
        } else {
            await this.processItem(item)
            while (this.incomingQueue.length) {
                const nextItem = this.incomingQueue.shift()
                await this.processItem(nextItem!)
            }
        }
    }

    async processItem(item: IncomingItem) {
        this.busy = true
        if (item.kind === 'IncomingMessage') {
            await this._chat.handleMessage(this._chat, item.ctx)
        }
        else if (item.kind === 'IncomingAction') {
            await this._chat.handleAction(this._chat, item.ctx)
        }
        else if (item.kind === 'IncomingEvent') {
            await this._chat.handleEvent(this._chat, item.ctx, item.typ, item.d)
        }
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



export interface ChatState {
    treeState: TreeState,
    renderedElements: RenderedElement[],
    inputHandler: (ctx: TelegrafContext) => Promise<void | boolean>,
    actionHandler: (ctx: TelegrafContext) => Promise<void>,
}

export const emptyChatState = (): ChatState => ({
    treeState: {},
    renderedElements: [],
    inputHandler: async function () { },
    actionHandler: async function () { },
})


export interface Application<C> {
    renderer: (ctx: TelegrafContext) => ChatRenderer,
    renderFunc: (s: C) => readonly [RenderDraft, (renderer: ChatRenderer) => Promise<C>],
    init: (ctx: TelegrafContext, renderer: ChatRenderer, chat: ChatHandler2<C>, chatdata: C) => Promise<any>,
    handleMessage: (
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<C>,
        chatdata: C,
    ) => Promise<any>,
    handleAction: (
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<C>,
        chatdata: C,
    ) => Promise<any>,
    chatData: () => C
}

export const createChatHandlerFactory = (app: Application<ChatState>): ChatHandlerFactory<ChatHandler2<ChatState>> =>
    async ctx => {
        const renderer = app.renderer(ctx)

        const onStateUpdated = (chatState: ChatState) => (src: string) => async () => {
            console.log(`onStateUpdated by ${src}`);
            const [draft, render] = app.renderFunc(chatState)

            for (const e of draft.effects) {
                await e.element.callback()
            }

            return await render(renderer)
        }

        const chatdata = app.chatData() 
        const chat = new QueuedChatHandler<ChatState>(t => ({
            chatdata,
            handleAction: async (self, ctx) => {
                return app.handleAction(ctx, renderer, t, self.chatdata)
            },
            handleMessage: async (self, ctx) => {
                return app.handleMessage(ctx, renderer, t, self.chatdata)
            },
            handleEvent: async (self, ctx: TelegrafContext, typ: string, f) => {
                if (typ == 'updated') {
                    self.chatdata = await onStateUpdated(f ? f(self.chatdata) : self.chatdata)("handleEvent")()
                }
            }
        }))

        await app.init(ctx, renderer, chat, chatdata)

        return chat
    }

export const genericRenderFunction = <
    P, C extends ComponentElement, S extends AppReqs<C>, Els extends GetAllBasics<C>
>
    (app: (props: P) => C, gc: () => S, props: P, createDraft: ((els: Els[]) => RenderDraft) = defaultCreateDraft) =>
    (chatState: ChatState): readonly [RenderDraft, (renderer: ChatRenderer) => Promise<ChatState>] => {

        const [els, treeState] = ElementsTree.createElements(app, gc(), props, chatState.treeState)

        const draft = createDraft(els)
        const inputHandler = draftToInputHandler(draft)
        const actions = createRenderActions(chatState.renderedElements, draft.messages)

        return [draft, async (renderer: ChatRenderer): Promise<ChatState> => {
            const renderedElements = await renderActions(renderer, actions)
            const actionHandler = renderedElementsToActionHandler(renderedElements)
            return {
                treeState,
                inputHandler,
                actionHandler,
                renderedElements
            }
        }] as const
    }
