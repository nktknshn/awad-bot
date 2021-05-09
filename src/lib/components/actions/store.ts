import { StoreF2 } from "Lib/storeF";
import { Utils } from "Lib/types-util";
import * as CA from 'Lib/chatactions'
import {
    applyActionEventReducer, ApplyActionsEvent,
    createActionEvent,
    makeEventReducer,
    renderEvent
} from "Lib/event"
import * as F from 'fp-ts/lib/function'

type AppEvents<R, H> = ApplyActionsEvent<R, H, AppEvents<R, H>>

export const connectFStore =
    <R extends { store: StoreF2<unknown, unknown> }, H>
        (u: Utils<R, H, AppEvents<R, H>, {}>) =>
        u.action(
            async ({ app, queue, chatdata }) => ({
                ...chatdata,
                store: chatdata.store.withDispatch(
                    F.flow(
                        app.actionReducer,
                        createActionEvent,
                        queue.handleEvent()
                    )
                )
            })
        )
