import { empty, GetSubState } from "Lib/chatstate";
import { BasicAppEvent } from "Lib/types-util";
import { AppBuilder } from "Lib/appbuilder";
import * as CA from 'Lib/chatactions';
import * as AP from 'Lib/newapp';
import { pipe } from "fp-ts/lib/pipeable";
import { Do } from 'fp-ts-contrib/Do'

export type WithRenderTimerState = GetSubState<typeof renderTimerState>

export type WithRenderTimer<R extends WithRenderTimerState, H> = {
    startTimer: CA.AppChatAction<R, H>
    stopTimer: CA.AppChatAction<R, H>
    wrapInTimer: (a: CA.AppChatAction<R, H>) => CA.AppChatAction<R, H>
}

export const renderTimerState = async () => ({
    timerStarted: empty<number>(),
    timerFinished: empty<number>(),
    timerDuration: 0,
})

export function withTimer<R extends WithRenderTimerState, H, Ext, RootComp>
    (a: AppBuilder<R, H, Ext, RootComp>)
    : AppBuilder<R, H, Ext & WithRenderTimer<R, H>, RootComp> {
    const startTimer = a.action(CA.mapState(s => ({ ...s, timerStarted: Date.now() })))
    const stopTimer = a.action(CA.mapState(s => ({
        ...s,
        timerFinished: Date.now(),
        timerDuration: Date.now() - s.timerStarted!
    })))
    return pipe(a,
        AP.extend(a => ({
            startTimer
            , stopTimer
            , wrapInTimer: (action: CA.AppChatAction<R, H>) => a.actions([startTimer, action, stopTimer])
        }))
    )
}