import { BasicAppEvent, Utils } from "./types-util"
import * as CA from './chatactions';
import { StoreF2 } from "./storeF";
import { addUserMessageIfNeeded, deferredRender, flushIfNeeded, FlushState } from "./components/actions/flush";
import { applyActionEventReducer, makeEventReducer } from "./event";
import { composeReducers } from "./reducer";
import { connectFStore } from "./components/actions/store";
import { saveToTrackerAction, UseTrackingRenderer } from "./components/actions/tracker";
import { reloadInterface } from "./components/actions/misc";

export function attachStoreExtension<R extends { store: StoreF2<unknown, unknown> }, H, Ext>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext>) {
    return ({ attachStore: connectFStore(a) })
}

export function handleActionExtension<R extends FlushState, H, Ext>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext>) {
    return ({
        handleAction: a.actions([
            CA.applyActionHandler,
            CA.replyCallback,
            CA.applyEffects,
            CA.render,
            flushIfNeeded(),
        ])
    })
}

export function handleEventExtension<Ext, R extends FlushState, H>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext>) {
    return {
        handleEvent: a.eventFunc(
            makeEventReducer(
                composeReducers(
                    applyActionEventReducer(),
                )
            ))
    }
}

export const handleMessage = <R extends FlushState & UseTrackingRenderer, H>() =>
    CA.tctx<R, H, BasicAppEvent<R, H>>(tctx =>
        CA.ifTextEqual('/start')(tctx)
            ? reloadInterface()
            : CA.sequence(
                [
                    CA.applyInputHandler,
                    saveToTrackerAction(),
                    addUserMessageIfNeeded(),
                    CA.applyEffects,
                    deferredRender()
                ]
            )
    )


export function handleMessageExtension<R extends FlushState & UseTrackingRenderer, H, Ext>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext>) {
    return ({ handleMessage: a.actionF(handleMessage) })
}

export function initExtension<R extends FlushState & UseTrackingRenderer, H, Ext, T extends any[]>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext>) {
    return (f: (...args: T) =>
        CA.AppChatAction<R, H, BasicAppEvent<R, H>>) => ({ init: (...args: T) => f(...args) })
}

export function reducerExtension<R, H, Ext>
    (a: Utils<R, H, BasicAppEvent<R, H>, Ext>) {
    return (reducer: (a: H | H[]) => CA.AppChatAction<R, H, BasicAppEvent<R, H>>[]) =>
        ({ actionReducer: a.reducer(reducer) })
}

