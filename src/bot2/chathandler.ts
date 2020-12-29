import { TelegrafContext } from "telegraf/typings/context";
import { ChatHandler, QueuedChatHandler } from "../lib/chathandler";
import { ChatHandlerFactory } from "../lib/chatsdispatcher";
import { ChatRenderer, createChatRenderer, messageTrackingRenderer } from "../lib/chatrender";
import { ElementsTree } from "../lib/tree";
import { ChatUI } from "../lib/ui";
import App, { AppDispatch, storeToDispatch } from './app';
import { AwadServices, userDtoFromCtx } from "./services";
import { createAwadStore } from "./store";
import { updateUser } from "./store/user";

export const createChatHandlerFactory = (services: AwadServices): ChatHandlerFactory =>
    async ctx => {

        const renderer = messageTrackingRenderer(
            services.users,
            createChatRenderer(ctx)
        )

        const ui = new ChatUI(renderer)
        const store = createAwadStore(services)

        let tree = new ElementsTree()
        
        tree.createElements(store, storeToDispatch(store), App)
        
        const renderFunc = (props: AppDispatch) =>
            ui.renderElementsToChat(
                tree.createElements(store, props, App)
            )

        const update = () => renderFunc(storeToDispatch(store))

        const user = await services.getOrCreateUser(userDtoFromCtx(ctx))

        for (const messageId of user.renderedMessagesIds ?? []) {
            try {
                await renderer.delete(messageId)
            } catch (e) {
                console.log(`Error deleting ${messageId}`)
            }
        }
        user.renderedMessagesIds = []

        store.subscribe(update)
        store.dispatch(updateUser(user))

        return new ChatImpl(
            ui, services, renderer, update
        )
    }

class ChatImpl implements ChatHandler {

    private queued: QueuedChatHandler

    constructor(
        ui: ChatUI,
        services: AwadServices,
        renderer: ChatRenderer,
        update: () => Promise<void>
    ) {
        this.queued = new QueuedChatHandler({
            async handleMessage(ctx) {

                if (ctx.chat?.type != 'private')
                    return

                console.log(`handleMessage ${ctx.message?.text}`)

                if (ctx.message?.message_id) {
                    await services.users.addRenderedMessage(
                        ctx.chat?.id!, ctx.message?.message_id)
                }

                if (ctx.message?.text == '/start') {
                    await ui.deleteAll()
                    await update()
                } else {
                    await ui.handleMessage(ctx)
                    await update()
                }
            },
            async handleAction(ctx) {

                if (ctx.chat?.type != 'private')
                    return

                console.log(`handleAction ${ctx.match![0]}`)

                await ui.handleAction(ctx)
                await update()

            },
        })
    }

    public handleMessage = async (ctx: TelegrafContext) => {
        return this.queued.handleMessage(ctx)
    }


    public handleAction = async (ctx: TelegrafContext) => {
        return this.queued.handleAction(ctx)
    }
}

