import { empty, GetSubState } from "Lib/chatstate";
import { BasicAppEvent } from "Lib/types-util";
import { AppBuilder } from "Lib/appbuilder";
import * as CA from 'Lib/chatactions';
import * as AP from 'Lib/newapp';
import { pipe } from "fp-ts/lib/pipeable";
import { Do } from 'fp-ts-contrib/Do'

export type WithTimerState = GetSubState<typeof timerState>

export type WithTimer<R extends WithTimerState, H> = {
    startTimer: CA.AppChatAction<R, H>
    stopTimer: CA.AppChatAction<R, H>
    wrapInTimer: (a: CA.AppChatAction<R, H>) => CA.AppChatAction<R, H>
}

export const timerState = async () => ({
    timerStarted: empty<number>(),
    timerFinished: empty<number>(),
    timerDuration: 0,
})

export function withTimer<R extends WithTimerState, H, Ext, ContextReq>
    (a: AppBuilder<R, H, Ext, ContextReq>)
    : AppBuilder<R, H, Ext & WithTimer<R, H>, ContextReq> {
    const startTimer = a.action(
        CA.mapState(s => ({ ...s, timerStarted: Date.now() })))

    const stopTimer = a.action(CA.mapState(s => ({
        ...s,
        timerFinished: Date.now(),
        timerDuration: Date.now() - s.timerStarted!
    })))
    
    return a.extend(a => ({
        startTimer
        , stopTimer
        , wrapInTimer: action =>
            a.sequence([startTimer, action, stopTimer])
    }))

}