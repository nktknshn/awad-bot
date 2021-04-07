import { TelegrafContext } from "telegraf/typings/context";
import { ChatHandler, QueuedChatHandler } from "../lib/chathandler";
import { ChatHandlerFactory } from "../lib/chatsdispatcher";
import { ChatRenderer, createChatRenderer, messageTrackingRenderer } from "../lib/chatrenderer";
import { ElementsTree } from "../lib/tree";
import { ChatUI } from "../lib/ui";
import App, { AppDispatch, storeToDispatch } from './app';
import { AwadServices, userDtoFromCtx } from "./services";
import { createAwadStore } from "./store";
import { updateUser } from "./store/user";
import { AppReqs, GetAllBasics, GetAllComps, StateReq } from "../lib/types-util";

type AppStateRequirements = AppReqs<ReturnType<typeof App>>
type AppBasics = GetAllBasics<ReturnType<typeof App>>

export const createChatHandlerFactory = (services: AwadServices): ChatHandlerFactory<ChatImpl> =>
    async ctx => {

        const renderer = messageTrackingRenderer(
            services.users,
            createChatRenderer(ctx)
        )

        const ui = new ChatUI()
        const store = createAwadStore(services)

        let tree = new ElementsTree()

        const renderFunc = (props: AppDispatch) =>
            ui.renderElementsToChat(
                renderer,
                tree.createElements(store, props, App) as AppBasics[]
            )

        const onStateUpdated = () => renderFunc(storeToDispatch(store))
        store.subscribe(onStateUpdated)

        const user = await services.getOrCreateUser(userDtoFromCtx(ctx))

        for (const messageId of user.renderedMessagesIds ?? []) {
            try {
                await renderer.delete(messageId)
            } catch (e) {
                console.log(`Error deleting ${messageId}`)
            }
        }

        user.renderedMessagesIds = []

        store.dispatch(updateUser(user))

        return new ChatImpl(
            ui, services, renderer, onStateUpdated
        )
    }

class ChatImpl implements ChatHandler {

    private queued: QueuedChatHandler

    constructor(
        public readonly ui: ChatUI,
        public readonly services: AwadServices,
        public readonly renderer: ChatRenderer,
        public readonly handleStateUpdated: () => Promise<void>
    ) {
        this.queued = new QueuedChatHandler({
            handleMessage: this._handleMessage,
            handleAction: this._handleAction
        })
    }

    private _handleMessage = async (ctx: TelegrafContext) => {
        if (ctx.chat?.type != 'private')
            return

        console.log(`handleMessage ${ctx.message?.text}`)

        if (ctx.message?.message_id) {
            await this.services.users.addRenderedMessage(
                ctx.chat?.id!, ctx.message?.message_id)
        }

        if (ctx.message?.text == '/start') {
            await this.ui.deleteAll(this.renderer)
            await this.handleStateUpdated()
        } else {
            if (await this.ui.handleMessage(ctx))
                this.renderer.delete(ctx.message?.message_id!)
            await this.handleStateUpdated()
        }
    }

    private _handleAction = async (ctx: TelegrafContext) => {

        if (ctx.chat?.type != 'private')
            return

        console.log(`handleAction ${ctx.match![0]}`)

        await this.ui.handleAction(ctx)
        await this.handleStateUpdated()

    }

    public handleMessage = async (ctx: TelegrafContext) => {
        return this.queued.handleMessage(ctx)
    }


    public handleAction = async (ctx: TelegrafContext) => {
        return this.queued.handleAction(ctx)
    }
}

