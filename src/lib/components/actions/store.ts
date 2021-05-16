import * as F from 'fp-ts/lib/function';
import {
    createActionEvent
} from "Lib/event";
import { StoreF2 } from "Lib/storeF";
import { BasicAppEvent } from "Lib/types-util";
import { AppBuilder } from "Lib/appbuilder";

export const connectFStore =
    <R extends Record<K, StoreF2<unknown,unknown>>, H, K extends keyof any = 'store'>
        (u: AppBuilder<R, H, {}, {}>, key: K) =>
        u.action(
            async ({ app, queue, chatdata }) => ({
                ...chatdata,
                [key]: chatdata[key].withDispatch(
                    F.flow(
                        app.actionReducer,
                        createActionEvent,
                        queue.handleEvent()
                    )
                )
            })
        )
