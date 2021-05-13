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

export const deferRender = (n: number) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { deferRender: number }>(s: R) =>
        ({ ...s, deferRender: n })
})

export const flushIfNeeded = <R extends FlushState, H>(a: CA.AppChatAction<R, H>) =>
    CA.withChatState<R, H>(
        c => c.doFlush ? a : CA.doNothing)

export const deferredRender = <R extends FlushState & FlushAction, H>(
    render: CA.AppChatAction<R, H> = CA.render,
    enabled = true
) =>
    CA.withChatState<R, H, BasicAppEvent<R, H>>(({ deferRender, bufferedInputEnabled }) =>
        enabled && bufferedInputEnabled && deferRender > 0
            ? CA.scheduleEvent(
                deferRender,
                createActionEvent([
                    render,
                    CA.mapState(s =>
                        setBufferedInputEnabled(!s.bufferedOnce).f(s)
                    ),
                ]))
            : render
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