import { ChatState, chatState, application, genericRenderComponent, defaultRenderScheme } from "../lib/application";
import { getTrackingRendererE, removeMessages } from "../lib/chatrenderer";
import { ChatActionReducer, composeReducers, extendDefaultReducer, reducer } from '../lib/reducer';
import { AppActions, AppActionsFlatten, buildApp, GetAllInputHandlers, GetAllInputHandlersTypes, _AppActionsFlatten } from "../lib/types-util";
import App from './app';
import { AwadServices, userDtoFromCtx } from "./services";
import { AwadStore, createAwadStore } from "./store";
import { updateUser } from "./store/user";
import { storeToDispatch } from "./storeToDispatch";
import { clearChat } from '../lib/inputhandler';
import { createActionEvent, applyActionEventReducer, ApplyActionsEvent, makeEventReducer, renderEvent } from 'Lib/event';
import { identity } from 'fp-ts/lib/function';
import { ChatActionContext } from '../lib/chatactions';
import { createDefaultRenderer, initTrackingRenderer, saveToTrackerAction, UseTrackingRenderer, withTrackingRenderer } from 'Lib/components/actions/tracker';
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";

import * as CA from 'Lib/chatactions';
import * as FL from "Lib/components/actions/flush";
import { TelegrafContext } from 'telegraf/typings/context';
import { createLevelTracker } from "bot3/leveltracker";

type AppState = { store: ReturnType<typeof createAwadStore> } & UseTrackingRenderer
type AppAction = AppActionsFlatten<typeof App>
type AppEvent = ApplyActionsEvent<AppState, AppAction, AppEvent>
type AppEvents<R, H> = ApplyActionsEvent<R, H, AppEvents<R, H>>

const add = <T>(arg: T) => async (tctx: TelegrafContext) => arg

export const bot2Reducers = <R, H, E>()
    : ChatActionReducer<"done" | "next" | Promise<unknown>, R, H, E> =>
    composeReducers(
        reducer(
            (a): a is Promise<unknown> => a instanceof Promise,
            _ => CA.doNothing
        ),
        reducer(
            (a): a is "done" | "next" => a === "done" || a === "next",
            _ => CA.doNothing
        )
    )

export const initBot2 = <K extends keyof any>(key: K) =>
    <R extends Record<K, AwadStore>, H>(services: AwadServices) =>
        async ({ chatdata, queue, tctx }: ChatActionContext<R, H, AppEvents<R, H>>) => {

            const user = await services.getOrCreateUser(userDtoFromCtx(tctx))

            chatdata[key].subscribe(() =>
                queue.handleEvent(tctx)(renderEvent()))

            chatdata[key].dispatch(updateUser(user))

            return chatdata
        }

const state = (services: AwadServices) => chatState([
    TR.withTrackingRenderer(services.users),
    add({ store: createAwadStore(services) })
])

const u = buildApp(App, state)

export const contextCreatorBot2 = u.mapState2<{ store: AwadStore }>()
    (s => ({
        ...s.store.getState(),
        dispatcher: storeToDispatch(s.store)
    }))

export function createAwadApplication(services: AwadServices) {

    return application<AppState, AppAction, AppEvent>({
        state: state(services),
        actionReducer: extendDefaultReducer(
            bot2Reducers()
        ),
        renderFunc: genericRenderComponent(
            defaultRenderScheme(),
            {
                component: App,
                contextCreator: contextCreatorBot2,
                props: { showPinned: true }
            }),
        init: CA.sequence([
            initTrackingRenderer(),
            initBot2('store')(services)
        ]),
        handleMessage:
            CA.branchHandler([
                [
                    CA.ifTextEqual('/start'),
                    [reloadInterface()],
                    [
                        CA.addRenderedUserMessage(),
                        saveToTrackerAction(),
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
