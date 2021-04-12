import { TelegrafContext } from "telegraf/typings/context"

export interface ChatHandler {
    handleMessage(ctx: TelegrafContext): Promise<unknown>
    handleAction(ctx: TelegrafContext): Promise<unknown>
    handleEvent(ctx: TelegrafContext, data: string): Promise<unknown>
}


type IncomingItem = IncomingMessage | IncomingAction | IncomingEvent

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

class IncomingEvent {
    kind: 'IncomingEvent' = 'IncomingEvent'
    constructor(readonly ctx: TelegrafContext, public readonly typ: string) {

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
        if(item.kind === 'IncomingMessage') {
            await this.chat.handleMessage(item.ctx)
        } 
        else if(item.kind === 'IncomingAction') {
            await this.chat.handleAction(item.ctx)
        } 
        else if(item.kind === 'IncomingEvent') {
            await this.chat.handleEvent(item.ctx, item.typ)
        }
        this.busy = false
    }

    async handleAction(ctx: TelegrafContext) {
        await this.push(new IncomingAction(ctx))
    }

    async handleMessage(ctx: TelegrafContext) {
        await this.push(new IncomingMessage(ctx))
    }

    async handleEvent(ctx: TelegrafContext, data: string) {
        await this.push(new IncomingEvent(ctx, data))
    }
}
