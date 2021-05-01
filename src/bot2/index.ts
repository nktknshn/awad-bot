import * as CA from '../lib/chatactions';
import { ChatState, createChatState, getApp, renderComponent, storeWithDispatcher } from "../lib/application";
import { getTrackingRenderer, removeMessages } from "../lib/chatrenderer";
import { extendDefaultReducer, reducer } from '../lib/reducer';
import { AppActions, AppActionsFlatten, GetAllInputHandlers, GetAllInputHandlersTypes, _AppActionsFlatten } from "../lib/types-util";
import App from './app';
import { AwadServices, userDtoFromCtx } from "./services";
import { createAwadStore } from "./store";
import { updateUser } from "./store/user";
import { storeToDispatch } from "./storeToDispatch";
import { clearChat } from '../lib/inputhandler';
import { applyActionEvent, applyActionEventReducer, ApplyActionsEvent, makeEventReducer, renderEvent } from 'Libevent';
import { identity } from 'fp-ts/lib/function';

export function createAwadApplication(services: AwadServices) {

    const { renderer, saveToTrackerAction, cleanChatAction } = getTrackingRenderer(services.users)

    type AppState = { store: ReturnType<typeof createAwadStore> }
    type AppAction = AppActionsFlatten<typeof App>
    type AppEvent = ApplyActionsEvent<AppState, AppAction, AppEvent>

    return getApp<AppState, AppAction, AppEvent>({
        renderer,
        chatStateFactory:
            () => createChatState({ store: createAwadStore(services) }),
        actionReducer: extendDefaultReducer(
            reducer(
                (a): a is Promise<unknown> => a instanceof Promise,
                _ => CA.mapState(identity)
            ),
            reducer(
                (a): a is "done" | "next" => a === "done" || a === "next",
                _ => CA.mapState(identity)
            )
        ),
        renderFunc: renderComponent({
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
                    queue.handleEvent(tctx, renderEvent()))

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
