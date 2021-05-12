// import { parseFromContext } from "../bot/bot-utils"
import { InputFile } from "telegraf/typings/telegram-types"
import { ComponentGenerator, ComponentElement } from "./component"
import { RenderDraft } from "./elements-to-messages"
import { InputHandlerData } from "./textmessage"
import { RenderedElement } from "./rendered-messages"
import { TreeState } from "./tree"

type Diff<T, U> = T extends U ? never : T

export type Subtract<T1 extends T2, T2> = {
    [P in Diff<keyof T1, keyof T2>]: T1[P]
}

export type AppType<P, E> = (props: P) => ComponentGenerator<E>

export class WithContext<C, R> {
    kind: 'WithContext' = 'WithContext'
    constructor(public readonly f: (ctx: C) => R) {

    }
}

export type BasicElement<H> = 
    TextElement 
    | TextPartElement 
    | NextMessageElement 
    | ButtonElement<H>
    | ButtonsRowElement <H>
    | InputHandlerElement<any>
    | RequestLocationButtonElement 
    | ActionsHandlerElement 
    | EffectElement<H>
    | FileElement 
    | KeyboardButtonElement

export type Element<H> = BasicElement<H> | ComponentElement

export function isComponentElement<H>(el: Element<H>): el is ComponentElement {
    return el.kind === 'component-with-state-connected'
        // || el.kind === 'component-with-state'
}

import { Lens } from 'monocle-ts'
import { Matcher2 } from "./input"

type LensObject<S> = {
    [k in keyof S]-?: Lens<S, S[k]>
}

type LensObjectWrapped<S> = {
    [k in keyof S]-?: Lens<S, S[k]>
}

// export type GetSetState<S> = {
//     getState: (initialState: S) => S & {lenses: LensObject<S>}
//     setState: (state: Partial<S>) => Promise<void>
//     setStateF: (f: (s: S) => S) => LocalStateAction
//     setStateFU: (state: Partial<S>) => LocalStateAction
// }

// export type GetSetState<S> = {
//     getState: (initialState: S) => S & {lenses: LensObject<S>}
//     setState: (f: (s: S) => S) => LocalStateAction<S>
// }
interface LocalStateAction<S> {
    kind: 'localstate-action',
    index: number[],
    f: (s: S) => S
}

// export interface LocalStateAction {
//     kind: 'localstate-action',
//     index: number[],
//     f: (s: TreeState) => TreeState
// }

export interface RenderedElementsAction {
    kind: 'rendered-elements-action',
    f: (rs: RenderedElement[]) => RenderedElement[]
}

export const wrapR = (f: (rs: RenderedElement[]) => RenderedElement[]): RenderedElementsAction => ({
    kind: 'rendered-elements-action',
    f
})

export class KeyboardButtonElement {
    kind: 'KeyboardButtonElement' = 'KeyboardButtonElement'
    constructor(readonly text: string | string[], readonly hide: boolean = false) { }
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

export interface Appliable<S = unknown, H= unknown> {
    kind: S
    apply(draft: RenderDraft<H>): RenderDraft<H>
}

export function isAppliable<H>(b: BasicElement<H> | Appliable) : b is Appliable {
    return 'apply' in b
}

export class ButtonElement<R> {
    kind: 'ButtonElement' = 'ButtonElement'
    constructor(
        readonly text: string,
        readonly data?: string,
        readonly callback?: () => R,
    ) { }

    mapCallback<R2>(f: (h: R) => R2): ButtonElement<R2>  {
        return new ButtonElement<R2>(
            this.text,
            this.data,
            () => f(this.callback!())
        )
    }
}

export class ButtonsRowElement<R> {
    kind: 'ButtonsRowElement' = 'ButtonsRowElement'
    constructor(
        readonly buttons: ButtonElement<R>[] = []
    ) { }

    mapCallback<R2>(f: (h: R) => R2): ButtonsRowElement<R2>  {
        return new ButtonsRowElement<R2>(
            this.buttons.map(_ => _.mapCallback(f))
        )
    }
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
        readonly callback: () => R,
        readonly type: 'OnCreated' | 'OnRemoved' | 'onRendered' = 'OnCreated'
    ) { }

    mapCallback<R2>(f: (h: R) => R2): EffectElement<R2>  {
        return new EffectElement<R2>(
            () => f(this.callback!()),
            this.type
        )
    }
}

export class ActionsHandlerElement {
    kind: 'ActionsHandlerElement' = 'ActionsHandlerElement'
    constructor(
        readonly callback: (input: string) => Promise<void>
    ) { }
}

// export type _InputHandlerElement<R> = InputHandlerElement<Matcher2<R>>

export class InputHandlerElement<R> {
    kind: 'InputHandlerElement' = 'InputHandlerElement'
    constructor(
        readonly callback: (
            input: InputHandlerData,
            next: () => R | undefined,
        ) => R | undefined
    ) { }

    mapCallback<R2>(f: (h: R | undefined) => R2): InputHandlerElement<R2>  {
        return new InputHandlerElement(
            (input, next) => f(this.callback!(input, () => f(next()as any) as any))
        )
    }
}


