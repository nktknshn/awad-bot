import * as CA from '../lib/chatactions';
import { ChatState, createChatState, getApp, renderComponent, storeWithDispatcher } from "../lib/chathandler";
import { getTrackingRenderer, removeMessages } from "../lib/chatrenderer";
import { StateAction } from "../lib/handlerF";
import { extendDefaultReducer } from '../lib/reducer';
import { AppActions, AppActionsFlatten, GetAllInputHandlers, _GetAllInputHandlers } from "../lib/types-util";
import App from './app';
import { AwadServices, userDtoFromCtx } from "./services";
import { createAwadStore } from "./store";
import { updateUser } from "./store/user";
import { storeToDispatch } from "./storeToDispatch";


export function createAwadApplication(services: AwadServices) {

    const { renderer, saveToTrackerAction } = getTrackingRenderer(services.users)

    type HandlerActions = AppActionsFlatten<typeof App>

    type MyState = { store: ReturnType<typeof createAwadStore> }
    type AppChatState = ChatState<MyState, HandlerActions>
    type AppAction = HandlerActions
    type AppStateAction = StateAction<AppChatState>

    const chatState = (): AppChatState => {
        const store = createAwadStore(services)
        return createChatState({ store })
    }

    return getApp<MyState, AppAction, "updated">({
        chatDataFactory: chatState,
        actionReducer: extendDefaultReducer(
            {
                isA: (a: Promise<any> | any): a is Promise<any> => a instanceof Promise,
                f: (a) => async (ctx) => {
                    await a
                    return ctx.chatdata
                }
            },
            {
                isA: (a: ("done" | "next") | any): a is "done" | "next" => a === "done" || a === "next",
                f: a => async ctx => ctx.chatdata
            }
        ),
        renderer,
        renderFunc: renderComponent({
            component: App,
            contextCreator: s => storeWithDispatcher(s.store, storeToDispatch)(),
            props: {}
        }),
        init: async (ctx) => {
            const user = await services.getOrCreateUser(userDtoFromCtx(ctx.tctx))

            if (user.renderedMessagesIds) {
                await removeMessages(user.renderedMessagesIds, ctx.renderer)
                user.renderedMessagesIds = []
            }

            ctx.chatdata.store.subscribe(() => ctx.chat.handleEvent(ctx.tctx, "updated"))
            ctx.chatdata.store.dispatch(updateUser(user))
            return ctx.chatdata
        },
        handleMessage: CA.fromList([CA.addRenderedUserMessage(), saveToTrackerAction, CA.applyInputHandler(), CA.render]),
        handleAction: CA.fromList([CA.applyActionHandler(), CA.replyCallback, CA.render]),
        handleEvent: async ({app, tctx, renderer, chat, chatdata}, event: "updated") => {
            return await app.renderFunc(chatdata).renderFunction(renderer)
        },
    })
}
