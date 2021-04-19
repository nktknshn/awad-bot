// import { parseFromContext } from "../bot/bot-utils"
import { InputFile } from "telegraf/typings/telegram-types"
import { ComponentGenerator, ComponentElement } from "./component"
import { RenderDraft } from "./elements-to-messages"
import { InputHandlerData } from "./messages"
import { TreeState } from "./tree"

type Diff<T, U> = T extends U ? never : T

export type Subtract<T1 extends T2, T2> = {
    [P in Diff<keyof T1, keyof T2>]: T1[P]
}

export type AppType<P> = (props: P) => ComponentGenerator

// export function isGenerator(compel: Element): compel is ComponentConstructor {
//     return Symbol.iterator in Object(compel)
// }
export class WithContext<C, R> {
    kind: 'WithContext' = 'WithContext'
    constructor(public readonly f: (ctx: C) => R) {

    }
}

interface Kinded<T> {
    kind: T 
}

export type BasicElement = 
    TextElement 
    | TextPartElement 
    | NextMessageElement 
    | ButtonElement<any>
    | ButtonsRowElement 
    | InputHandlerElement<any>
    | RequestLocationButtonElement 
    | ActionsHandlerElement 
    | EffectElement<any>
    | FileElement 
    | KeyboardElement

export type Element = BasicElement | ComponentElement

export function isComponentElement(el: Element): el is ComponentElement {
    return el.kind === 'component'
        || el.kind === 'component-with-state-connected'
        || el.kind === 'component-with-state'
}

export type GetSetState<S> = {
    getState: (initialState: S) => S
    setState: (state: Partial<S>) => Promise<void>
    setStateF: (f: (s: S) => S) => LocalStateAction
    setStateFU: (state: Partial<S>) => LocalStateAction
}

export interface LocalStateAction {
    kind: 'localstate-action',
    index: number[],
    f: (s: TreeState) => TreeState
}

// export function connected<P extends M, S, M, State, PP, R extends ComponentGenerator>(
//     mapper: (state: State) => M,
//     cons: CompConstructorWithState<P, S, R> | ((reqs: P) => (props: PP, getset: GetSetState<S>) => R)
// ) {
//     return ConnectedComp(cons, mapper)
// }

export class KeyboardElement {
    kind: 'Keyboard' = 'Keyboard'
    constructor(readonly text: string, readonly hide: boolean = true) { }

   
}

export class RequestLocationButtonElement {
    kind: 'RequestLocationButton' = 'RequestLocationButton'
    constructor(readonly text: string, readonly hide: boolean = true) { }
}

export class TextElement {
    kind: 'TextElement' = 'TextElement'
    constructor(
        readonly text: string
    ) { }
}

export class TextPartElement {
    kind: 'TextElementPart' = 'TextElementPart'
    constructor(
        readonly text: string
    ) { }
}

export class NextMessageElement {
    kind: 'NextMessage' = 'NextMessage'
    constructor() { }
}

export interface Appliable<S = unknown> {
    kind: S
    apply(draft: RenderDraft): RenderDraft
}

export function isAppliable(b: BasicElement | Appliable) : b is Appliable {
    return 'apply' in b
}

const buttonElementApply = (b: ButtonElement) => (d: RenderDraft) => {
    return {
        ...d
    }
}

export class ButtonElement<R = Promise<void>> {
    kind: 'ButtonElement' = 'ButtonElement'
    constructor(
        readonly text: string,
        readonly data?: string,
        readonly callback?: () => R,
    ) { }
    
    // public addContext<C>(ctx: C) {
    //     return new ButtonElement(this.text, this.data, () => this.callback(ctx))
    // }
    // public apply = buttonElementApply(this)
}

// export class InputHandler2<D>
// //  implements Appliable 
//  {
//     kind: 'InputHandler2' = 'InputHandler2'
//     constructor(
//         readonly callback: (
//             input: InputHandlerData,
//             next: () => Promise<boolean | void>,
//             dispatcher: D
//         ) => Promise<boolean | void>
//     ) { }

//     public apply = (draft: RenderDraft) => {
//         return draft
//     }
// }

export class ButtonsRowElement {
    kind: 'ButtonsRowElement' = 'ButtonsRowElement'
    constructor(
        readonly buttons: ButtonElement[] = []
    ) { }
}

export class FileElement {
    kind: 'FileElement' = 'FileElement'
    constructor(
        readonly file: InputFile, readonly isPhoto = false
    ) { }
}

export class EffectElement<R> {
    kind: 'EffectElement' = 'EffectElement'
    constructor(
        readonly callback: () => R
    ) { }
}


export class ActionsHandlerElement {
    kind: 'ActionsHandlerElement' = 'ActionsHandlerElement'
    constructor(
        readonly callback: (input: string) => Promise<void>
    ) { }
}

export class InputHandlerElement<R> {
    kind: 'InputHandlerElement' = 'InputHandlerElement'
    constructor(
        readonly callback: (
            input: InputHandlerData,
            next: () => R | undefined,
        ) => R | undefined
    ) { }
}


