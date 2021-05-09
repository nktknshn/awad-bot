import * as CA from '../lib/chatactions';
import { ChatState, createChatState, application, genericRenderComponent, defaultRenderScheme } from "../lib/application";
import { getTrackingRendererE, removeMessages } from "../lib/chatrenderer";
import { extendDefaultReducer, reducer } from '../lib/reducer';
import { AppActions, AppActionsFlatten, GetAllInputHandlers, GetAllInputHandlersTypes, _AppActionsFlatten } from "../lib/types-util";
import App from './app';
import { AwadServices, userDtoFromCtx } from "./services";
import { createAwadStore } from "./store";
import { updateUser } from "./store/user";
import { storeToDispatch } from "./storeToDispatch";
import { clearChat } from '../lib/inputhandler';
import { createActionEvent, applyActionEventReducer, ApplyActionsEvent, makeEventReducer, renderEvent } from 'Lib/event';
import { identity } from 'fp-ts/lib/function';


type AppState = { store: ReturnType<typeof createAwadStore> }
type AppAction = AppActionsFlatten<typeof App>
type AppEvent = ApplyActionsEvent<AppState, AppAction, AppEvent>

export function createAwadApplication(services: AwadServices) {

    const { renderer, saveToTrackerAction, cleanChatAction } = getTrackingRendererE(services.users)

    return application<AppState, AppAction, AppEvent>({
        renderer,
        chatStateFactory:
            async () => createChatState({ store: createAwadStore(services) }),
        actionReducer: extendDefaultReducer(
            reducer(
                (a): a is Promise<unknown> => a instanceof Promise,
                _ => CA.doNothing
            ),
            reducer(
                (a): a is "done" | "next" => a === "done" || a === "next",
                _ => CA.doNothing
            )
        ),
        renderFunc: genericRenderComponent(
            defaultRenderScheme(),
            {
                component: App,
                contextCreator: s => ({
                    ...s.store.getState(),
                    dispatcher: storeToDispatch(s.store)
                }),
                props: {}
            }),
        init: CA.sequence([
            cleanChatAction,
            async ({ chatdata, queue, tctx }) => {

                const user = await services.getOrCreateUser(userDtoFromCtx(tctx))

                chatdata.store.subscribe(() =>
                    queue.handleEvent(tctx)(renderEvent()))

                chatdata.store.dispatch(updateUser(user))

                return chatdata
            }
        ]),
        handleMessage:
            CA.branchHandler([
                [
                    CA.ifTextEqual('/start'),
                    [CA.addRenderedUserMessage(), clearChat, CA.render],
                    [
                        CA.addRenderedUserMessage(),
                        saveToTrackerAction,
                        CA.applyInputHandler,
                        CA.applyEffects,
                        CA.render
                    ]]]),
        handleAction: CA.sequence([
            CA.applyActionHandler,
            CA.replyCallback,
            CA.applyEffects,
            CA.render
        ]),
        handleEvent: makeEventReducer(applyActionEventReducer())
    })
}
