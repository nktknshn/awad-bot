import { empty, GetSubState } from "Lib/chatstate";
import { BasicAppEvent, Utils } from "Lib/types-util";
import * as CA from 'Lib/chatactions';

export type WithRenderTimerState = GetSubState<typeof renderTimerState>

export type WithRenderTimer<R extends WithRenderTimerState, H> = {
    renderWithTimer: CA.AppChatAction<R, H>
}

export const renderTimerState = async () => ({
    renderStarted: empty<number>(),
    renderFinished: empty<number>(),
    renderDuration: 0,
})

export function renderWithTimer<R extends WithRenderTimerState, H, Ext, RootComp>
    (a: Utils<R, H, Ext, RootComp>)
    : Utils<R, H, Ext & WithRenderTimer<R, H>, RootComp> {
    return a.extend(a => ({
        renderWithTimer: a.actions([
            CA.mapState(s => ({ ...s, renderStarted: Date.now() })),
            CA.render,
            CA.mapState(s => ({
                ...s,
                renderFinished: Date.now(),
                renderDuration: Date.now() - s.renderStarted!
            })),
        ])
    }))
}