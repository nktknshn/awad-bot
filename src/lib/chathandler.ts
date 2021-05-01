import { TelegrafContext } from "telegraf/typings/context"
import { ChatRenderer, createChatRenderer } from "./chatrenderer"
import { ChatHandlerFactory } from "./chatsdispatcher"
import { Application, ChatState } from './application'
import { mylog } from "./logging"
import { render } from "./chatactions"

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

interface InitializedApp<R, H, E> {
    app: Application<R, H, E>,
    chatdata: ChatState<R, H>,
    renderer: ChatRenderer
}

function initApplication<R, H, E>(app: Application<R, H, E>) {
    return async (ctx: TelegrafContext): Promise<InitializedApp<R, H, E>> => {
        const renderer = (app.renderer ?? createChatRenderer)(ctx)
        const { chatdata } = app.renderFunc(app.chatStateFactory(ctx))

        return {
            app,
            chatdata,
            renderer
        }
    }
}

function createChatHandler<R, H, E>(
    { app, chatdata, renderer }: InitializedApp<R, H, E>
): QueuedChatHandler<ChatState<R, H>, E> {
    return new QueuedChatHandler<ChatState<R, H>, E>(chat => ({
        chatdata,
        handleAction: async (self, ctx) => {
            self.setChatData(
                self,
                await app.handleAction!(
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
    }))
}

export const createChatHandlerFactory = <R, H, E>(app: Application<R, H, E>)
    : ChatHandlerFactory<ChatHandler2<E>, E> =>
    async ctx => {
        mylog("createChatHandlerFactory");

        const a = await initApplication(app)(ctx)

        const chat = createChatHandler(a)

        if (app.init) {
            chat._chat.setChatData(
                chat._chat,
                await app.init({ app, tctx: ctx, renderer: a.renderer, queue: chat, chatdata: a.chatdata })
            )
        }

        return chat
    }




