import { Application, ChatState, genericRenderFunction, storeWithDispatcher } from "../lib/chathandler";
import { removeMessages, trackingRenderer } from "../lib/chatrenderer";
import { defaultHandler, handlerChain, or, startHandler, withContextOpt } from '../lib/handler';
import App from './app';
import { AwadServices, userDtoFromCtx } from "./services";
import { createAwadStore } from "./store";
import { updateUser } from "./store/user";
import { storeToDispatch } from "./storeToDispatch";

// type AppStateRequirements = AppReqs<ReturnType<typeof App>>
// type AppElements = GetAllBasics<ReturnType<typeof App>> | InputHandlerElement
// export type AwadContextT = RootState & {
//     dispatcher: ReturnType<typeof storeToDispatch>
// }


export function createAwadApplication(services: AwadServices): Application<ChatState> {

    const { renderer, saveMessageHandler } = trackingRenderer(services.users)
    const store = createAwadStore(services)

    const getContext = storeWithDispatcher(store, storeToDispatch)

    return {
        renderer,
        renderFunc: genericRenderFunction(App, {}, getContext),
        init: async (ctx, renderer, chat, chatdata) => {
            const user = await services.getOrCreateUser(userDtoFromCtx(ctx))

            if (user.renderedMessagesIds) {
                await removeMessages(user.renderedMessagesIds, renderer)
                user.renderedMessagesIds = []
            }

            store.subscribe(() => chat.handleEvent(ctx, "updated"))
            store.dispatch(updateUser(user))
        },
        handleMessage: withContextOpt(
            handlerChain([
                saveMessageHandler,
                or(startHandler, defaultHandler)
            ])),
        // handleAction: defaultHandleAction
        // chatData: emptyChatState,
    }
}
