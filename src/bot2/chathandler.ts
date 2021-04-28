import * as A from 'fp-ts/lib/Array';
import { identity } from "fp-ts/lib/function";
import * as O from 'fp-ts/lib/Option';
import { pipe } from "fp-ts/lib/pipeable";
import { parseFromContext } from "../lib/bot-util";
import { ChatState, emptyChatState, genericRenderFunction, getApp, storeWithDispatcher } from "../lib/chathandler";
import { getTrackingRenderer, removeMessages } from "../lib/chatrenderer";
import { defaultCreateDraft } from "../lib/elements-to-messages";
import { applyRenderedElementsAction, chainInputHandlers, getActionHandler } from '../lib/handler';
import { StateAction } from "../lib/handlerF";
import { AppActionsFlatten } from "../lib/types-util";
import { addRenderedUserMessage } from '../lib/usermessage';
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


export function createAwadApplication(services: AwadServices) {

    const { renderer, saveMessageHandler } = getTrackingRenderer(services.users)

    type HandlerActions = AppActionsFlatten<typeof App>
    type MyState = { store: ReturnType<typeof createAwadStore> }
    type AppChatState = ChatState<MyState, HandlerActions>
    type AppAction = HandlerActions
    type AppStateAction = StateAction<AppChatState>

    function actionToStateAction(a: AppAction | AppAction[]): AppStateAction[] {
        if (Array.isArray(a))
            return A.flatten(a.map(actionToStateAction))
        else if (a === 'done') {
            return [identity]
        }
        else if (a === 'next') {
            return [identity]
        }
        else if ('kind' in a && a.kind === 'rendered-elements-action') {
            return [applyRenderedElementsAction(a)]
        }
        else {
            return [identity]
        }
        // else if (a.kind === 'chat-action') {
        //     return [applyChatStateAction(a.f)]
        // }

        // return a
    }

    const chatState = (): AppChatState => {
        const store = createAwadStore(services)

        return {
            ...emptyChatState(),
            store
        }
    }

    return getApp<MyState, AppAction, "updated">({
        chatDataFactory: chatState,
        renderer,
        renderFunc: genericRenderFunction(
            App, {},
            s => storeWithDispatcher(s.store, storeToDispatch)(),
            defaultCreateDraft,
            (rdr) => ctx => {
                return chainInputHandlers(
                    rdr.inputHandlers.reverse().map(_ => _.element.callback),
                    parseFromContext(ctx)
                )
            },
            getActionHandler
        ),
        init: async (app, ctx, renderer, chat, chatdata) => {
            const user = await services.getOrCreateUser(userDtoFromCtx(ctx))

            if (user.renderedMessagesIds) {
                await removeMessages(user.renderedMessagesIds, renderer)
                user.renderedMessagesIds = []
            }

            chatdata.store.subscribe(() => chat.handleEvent(ctx, "updated"))
            chatdata.store.dispatch(updateUser(user))
        },
        handleMessage: async (app, ctx, renderer, queue, chatdata) => {
            if (!chatdata.inputHandler) {
                return chatdata
            }

            const as = chatdata.inputHandler(ctx)

            if (!as)
                return chatdata

            let data = actionToStateAction(
                [as, addRenderedUserMessage(ctx.message?.message_id!)])
                .reduce((cd, f) => f(cd), chatdata)

            const [{ treeState, inputHandler, effectsActions }, render] = app.renderFunc(
                data
            )

            return await render(renderer)
        },
        handleAction: async (app, ctx, renderer, queue, chatdata) => {
            return await pipe(
                O.fromNullable(chatdata.actionHandler)
                , O.chainNullableK(f => f(ctx))
                , O.map(actionToStateAction)
                , O.map(as => as.reduce((cd, f) => f(cd), chatdata))
                , O.map(s => [s, app.renderFunc(s)] as const)
                , O.map(([s, [{ effectsActions }, render]]) => render(renderer)
                    // effectsActions.length
                    //     ? app.handleEvent(
                    //         app, ctx, renderer, queue, s,
                    //         {
                    //             kind: 'StateActionEvent',
                    //             actions: effectsActions
                    //         })
                    //     : render(renderer)
                )
                , O.fold(async () => chatdata, (f): Promise<AppChatState> => f)

            ).then(async data => ctx.answerCbQuery().then(_ => data))
        },
        handleEvent: async (app, ctx, renderer, queue, chatdata, event: "updated") => {
            return await app.renderFunc(chatdata)[1](renderer)
        },
        queueStrategy: function () {

        },
    })
}
