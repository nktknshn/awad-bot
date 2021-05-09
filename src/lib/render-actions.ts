import { areSameMediaGroup, mediaGroup } from "../bot3/mediagroup";
import { areSameTextMessages } from "./bot-util";
import { OutcomingMessageType } from "./elements-to-messages";
import { mylog } from "./logging";
import { RenderedElement } from "./rendered-messages";
import { usermessage } from "./usermessage";


type R<B> = { canReplace: (other: B) => boolean }

export function createRenderTasks<T extends R<B>, B>(
    present: T[],
    next: B[],
    areSame: (a: T, b: B) => boolean,
    actionLeave: (item: T, newItem: B) => void =
        item => mylog(`leave ${item}`),
    actionReplace: (item: T, newItem: B) => void
        = (item, newItem) => mylog(`replace ${item} with ${newItem}`),
    actionDelete: (item: T) => void = (item) => mylog(`delete ${item}`),
    actionCreate: (item: B) => void = (item) => mylog(`create ${item}`)
) {

    present = [...present]
    next = [...next]

    let result: T[] = [...present]
    let idx = 0

    while (result[idx] !== undefined || next.length) {

        const r = result[idx]
        const n = next.shift()

        if (n === undefined) {
            result.splice(idx, 1)
            idx -= 1
            actionDelete(r)
        }
        else if (r === undefined) {
            actionCreate(n)
            continue
        }
        else if (areSame(r, n)) {
            actionLeave(r, n)
        }
        else if (
            present.findIndex(v => areSame(v, n)) > idx
        ) {
            result.splice(idx, 1)
            next = [n, ...next]
            idx -= 1
            actionDelete(r)
        }
        else if (present.findIndex(v => areSame(v, next[0])) > idx) {
            if (r.canReplace(n))
                actionReplace(r, n)
            else {
                result.splice(idx, 1)
                next = [n, ...next]
                idx -= 1
                actionDelete(r)
            }
        }
        else if (next[0] === undefined) {
            if (r.canReplace(n))
                actionReplace(r, n)
            else {
                result.splice(idx, 1)
                next = [n, ...next]
                idx -= 1
                actionDelete(r)
            }
        }
        else {
            if (r.canReplace(n))
                actionReplace(r, n)
            else {
                result.splice(idx, 1)
                next = [n, ...next]
                idx -= 1
                actionDelete(r)
            }
        }

        idx += 1
    }

    return result
}

function areSame(a: RenderedElement, b?: OutcomingMessageType) {

    if (!b)
        return false

    if (a.kind === 'RenderedUserMessage' && b.kind === 'OutcomingUserMessage') {
        return usermessage.equals(a, b)
    }
    else if (a.kind === 'BotMessage' && b.kind === 'TextMessage') {
        return areSameTextMessages(a.input, b)
    }
    else if (a.kind === 'BotDocumentMessage' && b.kind === 'FileMessage') {
        return a.input.element.file == b.element.file
    }
    else if (a.kind === 'RenderedPhotoGroup' && b.kind === 'OutcomingPhotoGroupMessage') {
        return mediaGroup.equals(a, b)
    }

    return false
}

export namespace RenderActions {
    export class Keep {
        kind: 'Keep' = 'Keep'
        constructor(readonly element: RenderedElement, readonly newElement: OutcomingMessageType) { }
    }
    export class Replace {
        kind: 'Replace' = 'Replace'
        constructor(readonly element: RenderedElement, readonly newElement: OutcomingMessageType) { }
    }
    export class Remove {
        kind: 'Remove' = 'Remove'
        constructor(readonly element: RenderedElement) { }
    }
    export class Create {
        kind: 'Create' = 'Create'
        constructor(readonly newElement: OutcomingMessageType) { }
    }
}


export type RenderActions = RenderActions.Keep | RenderActions.Replace | RenderActions.Remove | RenderActions.Create

export function createRenderActions(renderedElements: RenderedElement[], nextElements: OutcomingMessageType[]) {

    const actions: RenderActions[] = []

    mylog({ "renderedElements": renderedElements });
    mylog({ "nextElements": nextElements });

    createRenderTasks(
        renderedElements,
        nextElements,
        areSame,
        (leaveThis, leaveThat) => {
            actions.push(new RenderActions.Keep(leaveThis, leaveThat))
        },
        (replaceThis, withThat) => {
            actions.push(new RenderActions.Replace(replaceThis, withThat))
        },
        (removeThis) => {
            actions.push(new RenderActions.Remove(removeThis))
        },
        (createThis) => {
            actions.push(new RenderActions.Create(createThis))
        }
    )

    return actions
}
