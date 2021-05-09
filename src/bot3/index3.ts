import * as F from 'fp-ts/lib/function';
import { createChatState, defaultRenderScheme, genericRenderComponent, application } from "Lib/application";
import * as CA from 'Lib/chatactions';
import { getTrackingRendererE } from 'Lib/chatrenderer';
import { applyActionEventReducer, ApplyActionsEvent, createActionEvent, makeEventReducer, renderEvent } from 'Lib/event';
import { clearChat } from "Lib/inputhandler";
import { extendDefaultReducer, flushReducer, storeReducer } from 'Lib/reducer';
import { StoreAction, storef, StoreF2 } from 'Lib/storeF';
import { AppActionsFlatten } from 'Lib/types-util';
import { PhotoSize } from 'telegraf/typings/telegram-types';
import { App } from './app';
import { levelDatabase, levelTracker } from './leveltracker';
import { getDispatcher } from './store';

export type Bot3StoreState = {
    isVisible: boolean,
    items: (string | PhotoSize)[],
    secondsLeft: number,
    timer: NodeJS.Timeout | undefined,
    stringCandidate: string | undefined,
}


export const store = storef<Bot3StoreState>({
    isVisible: false,
    items: [],
    secondsLeft: 0,
    timer: undefined,
    stringCandidate: undefined
})

export type Bot3Dispatcher = ReturnType<typeof getDispatcher>

export type Bot3AppState = 
{
    store: typeof store,
    deferredRenderTimer?: NodeJS.Timeout,
    deferRender: number
}

type AppAction = AppActionsFlatten<typeof App>
type AppEvent = ApplyActionsEvent<Bot3AppState, AppAction, AppEvent>

const { renderer, saveToTrackerAction, cleanChatAction,
    untrackRendererElementsAction } = getTrackingRendererE(
        levelTracker(levelDatabase('./mydb'))
    )

export const app = application<Bot3AppState, AppAction, AppEvent>({
    renderer,
    actionReducer: extendDefaultReducer(
        flushReducer(
            CA.sequence([
                untrackRendererElementsAction,
                CA.flush
            ])
        ),
        storeReducer('store')
    ),
    chatStateFactory: async () =>
        createChatState({
            store,
            // dispatcher: getDispatcher(store),
            deferRender: 0
        }),
    renderFunc: genericRenderComponent(
        defaultRenderScheme(),
        {
            component: App,
            props: { password: 'a' },
            contextCreator: chatstate => ({
                dispatcher: getDispatcher(chatstate.store),
                error: chatstate.error,
                ...chatstate.store.state
            }),
        }
    ),
    init: CA.sequence([
        cleanChatAction,
        async ({ app, queue, chatdata }) => {
            console.log('init');

            return {
                ...chatdata,
                store: chatdata.store.withDispatch(
                    F.flow(
                        app.actionReducer,
                        createActionEvent,
                        queue.handleEvent()
                    )
                )
            }
        }
    ]),
    handleMessage: CA.branchHandler([
        [
            CA.ifTextEqual('/start'),
            [CA.addRenderedUserMessage(), clearChat, CA.render],
            [
                CA.addRenderedUserMessage(),
                saveToTrackerAction,
                CA.applyInputHandler,
                CA.chatState(c =>
                    c.deferRender == 0
                        ? CA.render
                        : CA.scheduleEvent(c.deferRender, renderEvent())
                )
            ]
        ],
    ]),
    handleAction: CA.sequence(
        [CA.applyActionHandler, CA.replyCallback, CA.render]
    ),
    handleEvent: makeEventReducer(applyActionEventReducer())
})
