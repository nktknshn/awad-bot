import { TelegrafContext } from "telegraf/typings/context"
import { mylog } from "./logging"

export interface ChatHandler<R, E = any> {
    chatdata: R,
    handleMessage(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleAction(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleEvent(self: ChatHandler<R>, ctx: TelegrafContext, event: E): Promise<unknown>
    setChatData(self: ChatHandler<R>, d: R): void
}

export interface OpaqueChatHandler<E> {
    handleMessage(ctx: TelegrafContext): Promise<unknown>
    handleAction(ctx: TelegrafContext): Promise<unknown>
    handleEvent(ctx?: TelegrafContext): (event: E) => Promise<unknown>
}

type IncomingItem<E> = IncomingMessage | IncomingAction | IncomingEvent<E>

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

export class QueuedChatHandler<R, E> implements OpaqueChatHandler<E> {
    incomingQueue: IncomingItem<E>[] = []

    busy = false
    currentItem?: IncomingItem<E>

    rerender = false
    _chat: ChatHandler<R, E>

    constructor(readonly chat: ((t: QueuedChatHandler<R, E>) => ChatHandler<R>), busy = false) {
        this.busy = busy
        this._chat = chat(this)
    }

    async push(item: IncomingItem<E>) {

        if (this.busy) {
            mylog(`busy so item was queued: ${item.kind}`);
            this.incomingQueue.push(item)
        } else {
            mylog(`processing ${item.kind} ${item.kind !== 'IncomingEvent' && item.ctx.message?.message_id}`);

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

    async processItem(item: IncomingItem<E>) {
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
            await this._chat.handleEvent(this._chat, item.ctx, item.event)
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

    handleEvent(ctx: TelegrafContext) {
        return (event: E) =>
            this.push(new IncomingEvent(ctx, event))
    }
}





