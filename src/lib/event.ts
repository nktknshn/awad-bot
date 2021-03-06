import * as CA from './chatactions';
import { ChatActionReducer, reducer, reducerToFunction } from "./reducer";
import { ChatActionContext } from "./chatactions";
import { ChatState } from './chatstate';

export interface ApplyActionsEvent<R, H, E> {
    kind: 'apply-actions-event';
    actions: CA.AppChatAction<R, H, E>[];
}

export function createActionEvent2<R, H, E>(
    actions: CA.AppChatAction<R, H, E>[]
): ApplyActionsEvent<R, H, E> {
    return {
        kind: 'apply-actions-event',
        actions
    };
}

export const renderEvent = <R, H, E>() => createActionEvent<R, H, E>([])

export function createActionEvent<R, H, E>(
    actions: CA.AppChatAction<R, H, E>[]): ApplyActionsEvent<R, H, E> {
    return {
        kind: 'apply-actions-event',
        actions
    };
}

export const applyActionEventReducer = <R, H, E>() =>
    reducer(
        <T>(event: ApplyActionsEvent<R, H, E> | T)
            : event is ApplyActionsEvent<R, H, E> =>
            'kind' in event && event.kind === 'apply-actions-event',
        event => async (ctx: CA.ChatActionContext<R, H, E>) => {
            return await CA.sequence(event.actions)(ctx).then(s => {
                return s
            })
        }
    )

export function makeEventReducer<R, H, E>(
    reducer: ChatActionReducer<E, R, H, E>): (
        ctx: ChatActionContext<R, H, E>,
        event: E
    ) => Promise<ChatState<R, H>> {
    return async (ctx, event) => {
        return await CA.sequence(
            reducerToFunction(
                reducer
            )(event))(ctx);
    };
}
