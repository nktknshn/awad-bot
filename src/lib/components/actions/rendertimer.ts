import { empty, GetSubState } from "Lib/chatstate";
import { BasicAppEvent } from "Lib/types-util";
import { AppBuilder } from "Lib/appbuilder";
import * as CA from 'Lib/chatactions';

export type WithRenderTimerState = GetSubState<typeof renderTimerState>

export type WithRenderTimer<R extends WithRenderTimerState, H> = {
    renderWithTimer: (renderAction?: CA.AppChatAction<R, H>) => CA.AppChatAction<R, H>
}

export const renderTimerState = async () => ({
    renderStarted: empty<number>(),
    renderFinished: empty<number>(),
    renderDuration: 0,
})

export function addRenderWithTimer<R extends WithRenderTimerState, H, Ext, RootComp>
    (a: AppBuilder<R, H, Ext, RootComp>)
    : AppBuilder<R, H, Ext & WithRenderTimer<R, H>, RootComp> {
    return a.extend(a => ({
        renderWithTimer: (renderAction) => a.actions([
            CA.mapState(s => ({ ...s, renderStarted: Date.now() })),
            renderAction ?? CA.render,
            CA.mapState(s => ({
                ...s,
                renderFinished: Date.now(),
                renderDuration: Date.now() - s.renderStarted!
            })),
        ])
    }))
}