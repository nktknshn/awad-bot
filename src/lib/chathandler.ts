import { TelegrafContext } from "telegraf/typings/context"
import { ChatRenderer } from "./chatrenderer"
import { ChatHandlerFactory } from "./chatsdispatcher"
import { ComponentElement } from "./elements"
import { RenderDraft } from "./elements-to-messages"
import { createRenderActions } from "./render-actions"
import { RenderedElement } from "./rendered-messages"
import { ElementsTree, TreeState } from "./tree"
import { AppReqs, GetAllBasics } from "./types-util"
import { draftToInputHandler, renderActions, renderedElementsToActionHandler } from "./ui"

export interface ChatHandler<R> {
    chatdata: R,
    handleMessage(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleAction(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleEvent(self: ChatHandler<R>, ctx: TelegrafContext, data: string, more?: R): Promise<unknown>
}

export interface ChatHandler2 {
    handleMessage(ctx: TelegrafContext): Promise<unknown>
    handleAction(ctx: TelegrafContext): Promise<unknown>
    handleEvent<R = never>(ctx: TelegrafContext, data: string, d?: R): Promise<unknown>
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

export class QueuedChatHandler<R> implements ChatHandler2 {
    incomingQueue: IncomingItem[] = []
    busy = false

    constructor(readonly chat: ChatHandler<R>) { }

    async push(item: IncomingItem) {
        
        if(this.busy) {
            this.incomingQueue.push(item)
        } else {
            await this.processItem(item)
            while(this.incomingQueue.length) {
                const nextItem = this.incomingQueue.shift()
                await this.processItem(nextItem!)
            }
        }
    }

    async processItem(item: IncomingItem) {
        this.busy = true
        if(item.kind === 'IncomingMessage') {
            await this.chat.handleMessage(this.chat, item.ctx)
        } 
        else if(item.kind === 'IncomingAction') {
            await this.chat.handleAction(this.chat, item.ctx)
        } 
        else if(item.kind === 'IncomingEvent') {
            await this.chat.handleEvent(this.chat, item.ctx, item.typ, item.d)
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


export interface Application {
    renderer: (ctx: TelegrafContext) => ChatRenderer,
    renderFunc: (s: ChatState) => readonly [RenderDraft, (renderer: ChatRenderer) => Promise<ChatState>],
    init: (ctx: TelegrafContext, renderer: ChatRenderer, chat: ChatHandler2) => Promise<any>,
    handleMessage: (
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2,
        chatdata: ChatState,
        ) => Promise<any>
}

export const createChatHandlerFactory = (app: Application): ChatHandlerFactory<ChatHandler2> =>
    async ctx => {
        const renderer = app.renderer(ctx)

        const onStateUpdated = (chatState: ChatState) => (src: string) => async () => {
            console.log(`onStateUpdated by ${src}`);
            const [draft, r] = app.renderFunc(chatState)

            for (const e of draft.effects) {
                await e.element.callback()
            }

            return await r(renderer)
        }

        const chat = new QueuedChatHandler({
            chatdata: emptyChatState(),
            handleAction: async (self, ctx) => {
                await self.chatdata.actionHandler(ctx)
                await self.handleEvent(self, ctx, "updated")
            },
            handleMessage: async (self, ctx) => {
                app.handleMessage(ctx, renderer, chat, self.chatdata)
            },
            handleEvent: async (self, ctx: TelegrafContext, typ: string, chatdata) => {
                if (typ == 'updated') {
                    self.chatdata = await onStateUpdated(chatdata ?? self.chatdata)("handleEvent")()
                }
            }
        })

        await app.init(ctx, renderer, chat)

        return chat
    }

export const genericRenderFunction = <
        P, C extends ComponentElement, S extends AppReqs<C>, Els extends GetAllBasics<C>
    >
        (app: (props: P) => C, gc: () => S, createDraft: ((els: Els[]) => RenderDraft), props: P) =>
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
    