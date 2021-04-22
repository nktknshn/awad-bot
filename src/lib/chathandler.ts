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
import { draftToInputHandler, renderActions as getRenderActions, renderedElementsToActionHandler } from "./ui"
import * as A from 'fp-ts/lib/Array';
import { pipe } from "fp-ts/lib/pipeable"
import * as O from 'fp-ts/lib/Option';
import { StateAction } from "./handlerF"

export interface ChatHandler<R, E=any> {
    chatdata: R,
    handleMessage(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleAction(self: ChatHandler<R>, ctx: TelegrafContext): Promise<unknown>
    handleEvent(self: ChatHandler<R>, event: E): Promise<unknown>
    setChatData(self: ChatHandler<R>, d: R): void
}

export interface ChatHandler2<E = any> {
    handleMessage(ctx: TelegrafContext): Promise<unknown>
    handleAction(ctx: TelegrafContext): Promise<unknown>
    handleEvent(event: E): Promise<void>
}

// export interface ChatS<R> {
//     handleEvent(data: string, d?: StateAction<R>[]): Promise<unknown>
// }


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

class IncomingEvent<E> {
    kind: 'IncomingEvent' = 'IncomingEvent'
    constructor(public readonly event: E) {

    }
}

export class QueuedChatHandler<R, E=any> implements ChatHandler2<E> {
    incomingQueue: IncomingItem[] = []
    // eventQueue: IncomingEvent<any>[] = []

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

            if (item.kind === 'IncomingEvent') {

                // if (item.typ == 'updated') {
                //     this.incomingQueue = pipe(
                //         this.incomingQueue,
                //         A.findLastIndex(_ => _.kind === 'IncomingEvent'),
                //         O.fold(
                //             () => A.insertAt(0, item as IncomingItem)(this.incomingQueue),
                //             idx => A.insertAt(idx + 1, item as IncomingItem)(this.incomingQueue),
                //         ),
                //         O.fold(() => this.incomingQueue, v => v)
                //     )
                // }
                // else if (item.typ == 'render') {
                //     this.rerender = true
                //     // this.incomingQueue = pipe(
                //     //     this.incomingQueue,
                //     //     A.findIndex(
                //     //         _ => _.kind === 'IncomingEvent' && item.typ == 'render'
                //     //     ),
                //     //     O.fold(
                //     //         () => A.insertAt(this.incomingQueue.length, item as IncomingItem)(this.incomingQueue),
                //     //         idx => O.some(this.incomingQueue)
                //     //     ),
                //     //     O.fold(() => this.incomingQueue, as => as)
                //     // )
                // }
            }
            // else
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


            if (this.rerender) {
                await this.processItem(new IncomingEvent("render"))
                this.rerender = false
            }

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
            await this._chat.handleEvent(this._chat, item.event)
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

    async handleEvent<E>(event: E) {
        // mylog(`handleEvent: ${ctx.message?.message_id}`)
        await this.push(new IncomingEvent<E>(event))
    }
}


export type ChatState<R, H> = {
    treeState: TreeState,
    renderedElements: RenderedElement[],
    inputHandler?: (ctx: TelegrafContext) => (H | undefined),
    actionHandler?: (ctx: TelegrafContext) => H,
} & R

export const emptyChatState = <R, H>(): ChatState<{}, H> => ({
    treeState: {},
    renderedElements: [],
    // inputHandler: function (a) { return identity },
    // actionHandler: function (a) { return identity },
})

export interface Application<R, H, E=any> {
    renderer?: (ctx: TelegrafContext) => ChatRenderer,
    renderFunc: (s: R) => readonly [{
        draft: RenderDraft<H>,
        treeState: TreeState,
        inputHandler: (ctx: TelegrafContext) => H | undefined,
        effectsActions: H[]
    }, (renderer: ChatRenderer) => Promise<R>],
    init?: (app: Application<R, H, E>, ctx: TelegrafContext, renderer: ChatRenderer, chat: ChatHandler2<E>, chatdata: R) => Promise<any>,
    handleMessage: (
        app: Application<R, H, E>,
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<E>,
        chatdata: R,
    ) => Promise<R>,
    handleAction?: (
        app: Application<R, H, E>,
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<E>,
        chatdata: R,
    ) => Promise<R>,
    chatData: (ctx: TelegrafContext) => R,
    // handleStateAction: (
    //     app: Application<C, H, E>,
    //     ctx: TelegrafContext,
    //     renderer: ChatRenderer,
    //     chat: ChatHandler2<E>,
    //     chatdata: C,
    //     a: H[]
    // ) => Promise<any>,
    handleEvent: (
        app: Application<R, H, E>, 
        renderer: ChatRenderer, 
        chat: ChatHandler2<E>, 
        chatdata: R,
        event: E) => Promise<R>,
    queueStrategy: () => void
}

export function getApp<R, H, E=any>(
    app: Application<ChatState<R, H>, H, E>): Application<ChatState<R, H>, H, E> {
    return app
}

export const createChatHandlerFactory = <UserState, Actions, E=any>(app: Application<ChatState<UserState, Actions>, Actions, E>)
    : ChatHandlerFactory<ChatHandler2<E>, E> =>
    async ctx => {
        mylog("createChatHandlerFactory");

        const renderer = (app.renderer ?? createChatRenderer)(ctx)
        const chatdata = app.chatData(ctx)

        const [{ inputHandler, treeState }, _] = app.renderFunc(chatdata)

        chatdata.inputHandler = inputHandler
        chatdata.treeState = treeState

        const queue = new QueuedChatHandler<ChatState<UserState, Actions>, E>(t => ({
            chatdata,
            handleAction: async (self, ctx) => {
                self.setChatData(
                    self,
                    await app.handleAction!(app, ctx, renderer, t, self.chatdata))
            },
            handleMessage: async (self, ctx) => {
                mylog(`QueuedChatHandler.chat: ${ctx.message?.text} ${ctx.message?.message_id}`);

                self.setChatData(
                    self,
                    await app.handleMessage(app, ctx, renderer, t, self.chatdata)
                )
                mylog(`QueuedChatHandler.chat done ${ctx.message?.message_id}}`)

            },
            handleEvent: async (self, event: E) => {
                mylog(`handleEvent: ${event}`);

                self.setChatData(
                    self,
                    await app.handleEvent(app, renderer, t, self.chatdata, event)
                )
            },
            setChatData: (self, d) => {
                // mylog(self.chatdata.treeState.nextStateTree?.state)
                self.chatdata = d
                // mylog(self.chatdata.treeState.nextStateTree?.state)
            }
        }))

        app.init && await app.init(app, ctx, renderer, queue, chatdata)

        return queue
    }


export interface InputHandlerF<R> {
    (ctx: TelegrafContext): R
}

interface RenderScheme<
    RootComponent extends ComponentElement,
    RootReqs extends AppReqs<RootComponent>,
    Els extends GetAllBasics<RootComponent>,
    Rdr extends RenderDraft<HandlerReturn>,
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
    Rdr extends RenderDraft<HandlerReturn>,
    HandlerReturn extends AppActionsFlatten<RootComponent>
>
    (
        app: (props: Props) => RootComponent,
        props: Props,
        gc: (c: Ctx) => ContextReqs,
        createDraft: ((els: Els[]) => Rdr),
        draftToInputHandler: (draft: Rdr) => InputHandlerF<HandlerReturn | undefined>,
        renderedElementsToActionHandler: (rs: RenderedElement[]) => (ctx: TelegrafContext) => (HandlerReturn | undefined)
    ) =>
    (chatState: ChatState<Ctx, HandlerReturn>): readonly [{
        draft: Rdr,
        treeState: TreeState,
        inputHandler: InputHandlerF<HandlerReturn | undefined>,
        renderActions: Actions[],
        effectsActions: HandlerReturn[]
    }, (renderer: ChatRenderer) => Promise<ChatState<Ctx, HandlerReturn>>] => {

        const [els, treeState] = ElementsTree.createElements(app, gc(chatState), props, chatState.treeState)

        const draft = createDraft(els)
        const effects = draft.effects
        const effectsActions = effects.map(_ => _.element.callback())

        const inputHandler = draftToInputHandler(draft)
        const renderActions = createRenderActions(chatState.renderedElements, draft.messages)

        return [
            { draft, treeState, inputHandler, renderActions, effectsActions },
            async (renderer: ChatRenderer): Promise<ChatState<Ctx, HandlerReturn>> => {
                const renderedElements = await getRenderActions(renderer, renderActions)
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
