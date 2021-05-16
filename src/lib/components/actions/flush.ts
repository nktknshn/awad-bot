import * as CA from 'Lib/chatactions'
import { createActionEvent } from "Lib/event"
import { ChatActionReducer, chatStateAction } from "Lib/reducer"
import { BasicAppEvent } from "Lib/types-util"

export type FlushState = {
    doFlush: boolean
    deferredRenderTimer?: NodeJS.Timeout,
    deferRender: number,
    bufferedInputEnabled: boolean,
    bufferedOnce: boolean,
}

export type FlushAction = {
    flushAction: <R extends FlushState, H, E>() => CA.AppChatAction<R, H, E>
}

export const setBufferedInputEnabled = (bufferedInputEnabled: boolean) =>
    chatStateAction<{ bufferedInputEnabled: boolean }>(s =>
        ({ ...s, bufferedInputEnabled })
    )

export const setBufferedOnce = (bufferedOnce: boolean) =>
    chatStateAction<{ bufferedOnce: boolean }>(s =>
        ({ ...s, bufferedOnce })
    )
// export type WithFlushArgs = 
export const withFlush = ({
    deferRender = 1500,
    bufferedInputEnabled = false,
    bufferedOnce = false,
    doFlush = false
} = {}) => async () => ({
    doFlush,
    deferRender,
    bufferedInputEnabled,
    bufferedOnce,
})

export const setDeferRender = (n: number) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { deferRender: number }>(s: R) =>
        ({ ...s, deferRender: n })
})

export const flushIfNeeded = <R extends FlushState, H>(a: CA.AppChatAction<R, H>) =>
    CA.withChatState<R, H>(
        c => c.doFlush ? a : CA.doNothing)

export const deferredRender = <R extends FlushState & FlushAction, H>(
    { action = CA.render,
        enabled = true,
        waitForTimer = true
    }: {
        action?: CA.AppChatAction<R, H>,
        enabled?: boolean,
        waitForTimer?: boolean,
    } = {}
) =>
    CA.withChatState<R, H, BasicAppEvent<R, H>>(({ deferRender, deferredRenderTimer, bufferedInputEnabled }) =>
        enabled && bufferedInputEnabled && waitForTimer && deferRender > 0
            ? deferredRenderTimer
                ? CA.doNothing
                : CA.scheduleEvent(
                    deferRender,
                    createActionEvent([
                        action,
                        CA.sequence([
                            CA.mapState(s => ({ ...s, deferredRenderTimer: undefined })),
                            CA.mapState(s =>
                                setBufferedInputEnabled(!s.bufferedOnce).f(s),
                            )]),
                    ]))
            : action
    )

export const addUserMessageIfNeeded = <R extends FlushState, H, E>() =>
    CA.withChatState<R, H, E>(
        c => c.doFlush
            ? CA.doNothing
            : CA.addRenderedUserMessage()
    )

export const isFlush = (a: Flush | any): a is Flush => a.kind === 'flush'

export function flushReducer<R, H, E>(
    action: CA.AppChatAction<R, H, E>
): ChatActionReducer<Flush, R, H, E> {
    return {
        isA: isFlush,
        f: (a: Flush) => action
    }
}

export type Flush = { kind: 'flush' }
export const flush = (): Flush => ({ kind: 'flush' })