import { QueuedChat } from "../lib/chat";
import { ChatFactory } from "../lib/chatshandler";
import { createRenderer, createRenderFunc, messageTrackingRenderer } from "../lib/render";
import { UI } from "../lib/ui";
import { dtoFromCtx, Services } from "./services";
import { createStore } from "./store";
import { updateUser } from "./store/user";
import { App, stateToProps } from './app'

export const createChatCreator = (services: Services): ChatFactory =>
    async ctx => {

        const renderer = messageTrackingRenderer(
            services.users,
            createRenderer(ctx)
        )

        const ui = new UI(renderer)
        const renderFunc = createRenderFunc(ui, App)

        let user = await services.getUser(ctx.chat?.id!)

        if (!user) {
            user = await services.createUser(dtoFromCtx(ctx))
        }

        const store = createStore(services)
        const update = () => renderFunc(stateToProps(store, ui, services))

        if (user.renderedMessagesIds && user.renderedMessagesIds.length) {
            for (const messageId of user.renderedMessagesIds) {
                try {
                    await renderer.delete(messageId)
                } catch (e) {
                    console.log(`Error deleting ${messageId}`)
                }
            }
            user.renderedMessagesIds = []
        }

        store.subscribe(update)
        store.dispatch(updateUser(user))

        return new QueuedChat({
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
                    // if (state.onUpdated)
                    //     await state.onUpdated(state)
                    await renderer.delete(ctx.message.message_id)
                } else {
                    await ui.handleMessage(ctx)
                }
            },
            async handleAction(ctx) {

                if (ctx.chat?.type != 'private')
                    return

                console.log(`handleAction ${ctx.match![0]}`)
                await ui.handleAction(ctx)
            },
        })
    }