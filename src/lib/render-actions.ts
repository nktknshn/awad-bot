import { areSameTextMessages } from "./bot-util";
import { MessageType } from "./elements-to-messages";
import { RenderedElement } from "./rendered-messages";


type R<B> = { replacable: (other: B) => boolean }

export function createRenderTasks<T extends R<B>, B>(
    present: T[],
    next: B[],
    areSame: (a: T, b: B) => boolean,
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
            if (r.replacable(n))
                actionReplace(r, n)
            else {
                result.splice(idx, 1)
                next = [n, ...next]
                idx -= 1
                actionDelete(r)
            }
        }
        else if (next[0] === undefined) {
            if (r.replacable(n))
                actionReplace(r, n)
            else {
                result.splice(idx, 1)
                next = [n, ...next]
                idx -= 1
                actionDelete(r)
            }
        }
        else {
            if (r.replacable(n))
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


function areSame(a: RenderedElement, b?: MessageType) {

    if (!b)
        return false

    if (a.kind === 'UserMessage') {
        return false
    }
    else if (a.kind === 'BotMessage' && b.kind === 'TextMessage') {
        return areSameTextMessages(a.input, b)
    }
    else if (a.kind === 'BotDocumentMessage' && b.kind === 'FileMessage') {
        return a.input.element.file == b.element.file
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

    console.log("createRenderActions.renderedElements");
    console.log(JSON.stringify(renderedElements));
    console.log("createRenderActions.nextElements");
    console.log(JSON.stringify(nextElements));

    createRenderTasks(
        renderedElements,
        nextElements,
        areSame,
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
