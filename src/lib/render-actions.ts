import { areSameTextMessages } from "./bot-util";
import { MessageType } from "./elements-to-messages";
import { TextMessage } from "./messages";
import { BotDocumentMessage, BotMessage, RenderedElement, UserMessage } from "./rendered-messages";
import { FileElement } from "./elements";

export function createRenderTasks<T, B>(
    present: T[],
    next: B[],
    compareFunc: (a: T, b: B) => boolean,
    actionLeave: (item: T, newItem: B) => void =
        item => console.log(`leave ${item}`),
    actionReplace: (item: T, newItem: B) => void
        = (item, newItem) => console.log(`replace ${item} with ${newItem}`),
    actionDelete: (item: T) => void = (item) => console.log(`delete ${item}`),
    actionCreate: (item: B) => void = (item) => console.log(`create ${item}`)
) {

    present = [...present]
    next = [...next]

    let result: T[] = [...present]
    let idx = 0

    while (result[idx] !== undefined || next.length) {

        // console.log(`result=${result}, next=${next}`)

        const r = result[idx]
        const n = next.shift()
        // console.log(`r=${r} n=${n}`);

        if (n === undefined) {
            result.splice(idx, 1)
            idx -= 1
            actionDelete(r)
        }
        else if (r === undefined) {
            actionCreate(n)
            continue
        }
        else if (compareFunc(r, n)) {
            actionLeave(r, n)
        }
        else if (
            present.findIndex(v => compareFunc(v, n)) > idx
        ) {
            result.splice(idx, 1)
            next = [n, ...next]
            idx -= 1
            actionDelete(r)
        }
        else if (present.findIndex(v => compareFunc(v, next[0])) > idx) {
            actionReplace(r, n)
            // result[idx] = n
        }
        else if (next[0] === undefined) {
            actionReplace(r, n)
            // result[idx] = n
        }
        else {
            actionReplace(r, n)
        }

        idx += 1
    }

    return result
}


function compareFunc(a: RenderedElement, b: MessageType) {
    if (a instanceof UserMessage) {
        return false
    }
    else if (a instanceof BotMessage && b instanceof TextMessage) {
        return areSameTextMessages(a.input, b)
    }
    else if (a instanceof BotDocumentMessage && b instanceof FileElement) {
        return false
    }
    return false
}

export namespace Actions {
    export class Keep {
        kind: 'Keep' = 'Keep'
        constructor(readonly element: RenderedElement, readonly newElement: MessageType) { }
    }
    export class Replace {
        kind: 'Replace' = 'Replace'
        constructor(readonly element: RenderedElement, readonly newElement: MessageType) { }
    }
    export class Remove {
        kind: 'Remove' = 'Remove'
        constructor(readonly element: RenderedElement) { }
    }
    export class Create {
        kind: 'Create' = 'Create'
        constructor(readonly newElement: MessageType) { }
    }
}


export type Actions = Actions.Keep | Actions.Replace | Actions.Remove | Actions.Create

export function createRenderActions(renderedElements: RenderedElement[], nextElements: MessageType[]) {

    const actions: Actions[] = []

    createRenderTasks(
        renderedElements,
        nextElements,
        compareFunc,
        (leaveThis, leaveThat) => {
            actions.push(new Actions.Keep(leaveThis, leaveThat))
        },
        (replaceThis, withThat) => {
            actions.push(new Actions.Replace(replaceThis, withThat))
        },
        (removeThis) => {
            actions.push(new Actions.Remove(removeThis))
        },
        (createThis) => {
            actions.push(new Actions.Create(createThis))
        }
    )

    return actions
}
