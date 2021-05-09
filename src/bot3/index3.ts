import * as F from 'fp-ts/lib/function';
import { defaultRenderScheme, genericRenderComponent, application, createChatState } from "Lib/application";
import * as CA from 'Lib/chatactions';
import { getTrackingRendererE } from 'Lib/chatrenderer';
import { connectFStore } from 'Lib/components/actions/store';
import { withUserMessages } from 'Lib/context';
import { applyActionEventReducer, ApplyActionsEvent, createActionEvent, makeEventReducer, renderEvent } from 'Lib/event';
import { clearChat } from "Lib/inputhandler";
import { extendDefaultReducer, flushReducer, storeReducer } from 'Lib/reducer';
import { select } from 'Lib/state';
import { StoreAction, storef, StoreF2 } from 'Lib/storeF';
import { AppActionsFlatten,  addState } from 'Lib/types-util';
import { PhotoSize } from 'telegraf/typings/telegram-types';
import { App } from './app';
import { levelDatabase, levelTracker } from './leveltracker';
import { getDispatcher } from './store';

const { renderer, saveToTrackerAction, cleanChatAction,
    untrackRendererElementsAction } = getTrackingRendererE(
        levelTracker(levelDatabase('./mydb'))
    )

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
    stringCandidate: undefined,
})

export type Bot3AppState =
    {
        store: typeof store,
        deferredRenderTimer?: NodeJS.Timeout,
        deferRender: number,
        bufferedInputEnabled: boolean,
    }

const util = addState(App)<Bot3AppState>()
    .extend(
        u => ({
            attachStore: connectFStore(u)
        })
    )

export const contextCreatorBot3 = select(
    ((cs: Record<'store', StoreF2<Bot3StoreState>>) => ({
        dispatcher: getDispatcher(cs.store),
        ...cs.store.state
    })),
    withUserMessages,
)

const handleStart = util.actions([
    CA.addRenderedUserMessage(), clearChat, CA.render
])

const handleMessage = 
    CA.tctx(tctx =>
        CA.ifTextEqual('/start')(tctx)
            ? handleStart
            : defaultMessageHandler)

const defaultMessageHandler = util.actions(
    [
        CA.addRenderedUserMessage(),
        saveToTrackerAction,
        CA.applyInputHandler,
        CA.chatState(({ deferRender, bufferedInputEnabled }) =>
            bufferedInputEnabled
                ? CA.render
                : CA.scheduleEvent(deferRender, renderEvent())
        )
    ]
)

const handleAction = [
    CA.applyActionHandler,
    CA.replyCallback,
    CA.applyEffects,
    CA.render,
]

const handleEvent = util.eventFunc(
    makeEventReducer(applyActionEventReducer()))

export const app = application({
    // renderer,
    actionReducer: extendDefaultReducer(
        flushReducer(
            CA.sequence([
                untrackRendererElementsAction,
                CA.flush
            ])
        ),
        storeReducer('store')
    ),
    state:
        createChatState([
            async () => ({
                store,
                deferRender: 0,
                bufferedInputEnabled: false
            })]),
    renderFunc: genericRenderComponent(
        defaultRenderScheme(),
        {
            component: App,
            props: { password: 'a' },
            contextCreator: contextCreatorBot3,
        }
    ),
    init: util.actions([
        cleanChatAction,
        util.attachStore
    ]),
    handleMessage,
    handleAction: util.actions(handleAction),
    handleEvent
})
