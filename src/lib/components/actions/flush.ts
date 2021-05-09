import { chatstateAction } from "Lib/reducer"
import * as CA from 'Lib/chatactions'
import { BasicAppEvent } from "Lib/types-util"
import { createActionEvent } from "Lib/event"

export type FlushState = {
    doFlush: boolean
    deferredRenderTimer?: NodeJS.Timeout,
    deferRender: number,
    bufferedInputEnabled: boolean,
    bufferedOnce: boolean,
}


export const setBufferedInputEnabled = (bufferedInputEnabled: boolean) =>
    chatstateAction<{ bufferedInputEnabled: boolean }>(s =>
        ({ ...s, bufferedInputEnabled })
    )

export const withFlush = (values: {
    deferRender?: number,
    bufferedInputEnabled?: boolean,
    bufferedOnce?: boolean,
    doFlush?: boolean
} = {}) => async () => ({
    doFlush: values.doFlush ?? false,
    deferRender: values.deferRender ?? 1500,
    bufferedInputEnabled: values.bufferedInputEnabled ?? false,
    bufferedOnce: values.bufferedOnce ?? false,
})


export const flushIfNeeded = <R extends FlushState, H, E>() =>
    CA.chatState<R, H, E>(
        c => c.doFlush ? CA.flush : CA.doNothing)

export const deferredRender = <R extends FlushState, H>(
    enabled = true
) =>
    CA.chatState<R, H, BasicAppEvent<R, H>>(({ deferRender, bufferedInputEnabled }) =>
        enabled && bufferedInputEnabled
            ? CA.scheduleEvent(
                deferRender,
                createActionEvent([
                    CA.render,
                    CA.mapState(s =>
                        setBufferedInputEnabled(!s.bufferedOnce).f(s)
                    ),
                    flushIfNeeded()
                ]))
            : CA.sequence([
                CA.render,
                flushIfNeeded()
            ])
    )

export const addUserMessageIfNeeded = <R extends FlushState, H, E>() =>
    CA.chatState<R, H, E>(
        c => c.doFlush
            ? CA.doNothing
            : CA.addRenderedUserMessage()
    )