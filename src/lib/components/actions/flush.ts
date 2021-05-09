import { chatstateAction } from "Lib/reducer"

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

export const flushState = (values: {
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
