import { TelegrafContext } from "telegraf/typings/context"

export type ChatFactory = (ctx: TelegrafContext) => Promise<ChatHandler | undefined>

export interface ChatHandler {
    handleMessage(ctx: TelegrafContext): Promise<unknown>
    handleAction(ctx: TelegrafContext): Promise<unknown>
}


type IncomingItem = IncomingMessage | IncomingAction

class IncomingMessage {
    constructor(readonly ctx: TelegrafContext) {

    }
}

class IncomingAction {
    constructor(readonly ctx: TelegrafContext) {

    }
}

export class QueuedChatHandler implements ChatHandler {
    incomingQueue: IncomingItem[] = []
    busy = false

    constructor(readonly chat: ChatHandler) { }

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
        if(item instanceof IncomingMessage) {
            await this.chat.handleMessage(item.ctx)
        } 
        else if(item instanceof IncomingAction) {
            await this.chat.handleAction(item.ctx)
        }
        this.busy = false
    }

    async handleAction(ctx: TelegrafContext) {
        await this.push(new IncomingAction(ctx))
    }

    async handleMessage(ctx: TelegrafContext) {
        await this.push(new IncomingMessage(ctx))
    }
}
