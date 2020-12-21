import { areSameTextMessages } from "./bot-util";
import { componentToMessagesAndHandlers, MsgType } from "./component";
import { ActionsHandler, BotDocumentMessage, BotMessage, Effect, InputHandler, RenderedElement, TextMessage, UserMessage } from "./elements";
import { ComponentGenerator, FileElement } from "./types";

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

    // const rendered = [1, 2, 3, 4, 5, 6]
    // let next = [7, 2, 4, 5, 6, 8]
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
            console.log(`delete r=${r} n=${n}`);
            result.splice(idx, 1)
            idx -= 1
            actionDelete(r)
        }
        else if (r === undefined) {
            console.log(`create n=${n}`);
            // result.push(r)
            actionCreate(n)
            continue
        }
        else if (compareFunc(r, n)) {
            console.log(`skip r=${r} n=${n}`);
            actionLeave(r, n)
        }
        else if (
            present.findIndex(v => compareFunc(v, n)) > idx
        ) {
            console.log(`delete r=${r} n=${n}`);
            result.splice(idx, 1)
            next = [n, ...next]
            idx -= 1
            actionDelete(r)
        }
        else if (present.findIndex(v => compareFunc(v, next[0])) > idx) {
            console.log(`replace r=${r} n=${n}`);
            actionReplace(r, n)
            // result[idx] = n
        }
        else if (next[0] === undefined) {
            console.log(`replace r=${r} n=${n}`);
            actionReplace(r, n)
            // result[idx] = n
        }
        else {
            console.log(`replace r=${r} n=${n}`);
            actionReplace(r, n)
            // result[idx] = n
        }

        idx += 1
    }

    return result
}


function compareFunc(a: RenderedElement, b: MsgType) {
    if (a instanceof UserMessage) {
        return false
    }
    else if (a instanceof BotMessage && b instanceof TextMessage) {
        return areSameTextMessages(a.textMessage, b)
    }
    else if (a instanceof BotDocumentMessage && b instanceof FileElement) {
        return false
    }
    return false
}

export namespace Actions {
    export class Keep {
        kind: 'Keep' = 'Keep'
        constructor(readonly element: RenderedElement, readonly newElement: MsgType) { }
    }
    export class Replace {
        kind: 'Replace' = 'Replace'
        constructor(readonly element: RenderedElement, readonly newElement: MsgType) { }
    }
    export class Remove {
        kind: 'Remove' = 'Remove'
        constructor(readonly element: RenderedElement) { }
    }
    export class Create {
        kind: 'Create' = 'Create'
        constructor(readonly newElement: MsgType) { }
    }
}


export type Actions = Actions.Keep | Actions.Replace | Actions.Remove | Actions.Create

export function getTask(renderedElements: RenderedElement[], nextElements: MsgType[]) {

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
