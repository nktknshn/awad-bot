// import { parseFromContext } from "../bot/bot-utils"
import { InputFile } from "telegraf/typings/telegram-types"
import { ComponentGenerator, ComponentElement } from "./component"
import { RenderDraft } from "./elements-to-messages"
import { InputHandlerData } from "./messages"
import { RenderedElement } from "./rendered-messages"
import { TreeState } from "./tree"

type Diff<T, U> = T extends U ? never : T

export type Subtract<T1 extends T2, T2> = {
    [P in Diff<keyof T1, keyof T2>]: T1[P]
}

export type AppType<P> = (props: P) => ComponentGenerator

export class WithContext<C, R> {
    kind: 'WithContext' = 'WithContext'
    constructor(public readonly f: (ctx: C) => R) {

    }
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
        // || el.kind === 'component-with-state'
}

import { Lens } from 'monocle-ts'

type LensObject<S> = {
    [k in keyof S]-?: Lens<S, S[k]>
}

type LensObjectWrapped<S> = {
    [k in keyof S]-?: Lens<S, S[k]>
}


export type GetSetState<S> = {
    getState: (initialState: S) => S & {lenses: LensObject<S>}
    setState: (state: Partial<S>) => Promise<void>
    setStateF: (f: (s: S) => S) => LocalStateAction
    setStateFU: (state: Partial<S>) => LocalStateAction
}

export interface LocalStateAction {
    kind: 'localstate-action',
    index: number[],
    f: (s: TreeState) => TreeState
}

export interface RenderedElementsAction {
    kind: 'rendered-elements-action',
    f: (rs: RenderedElement[]) => RenderedElement[]
}

export const wrapR = (f: (rs: RenderedElement[]) => RenderedElement[]): RenderedElementsAction => ({
    kind: 'rendered-elements-action',
    f
})

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

export interface Appliable<S = unknown, H= unknown> {
    kind: S
    apply(draft: RenderDraft<H>): RenderDraft<H>
}

export function isAppliable(b: BasicElement | Appliable) : b is Appliable {
    return 'apply' in b
}

export class ButtonElement<R = any> {
    kind: 'ButtonElement' = 'ButtonElement'
    constructor(
        readonly text: string,
        readonly data?: string,
        readonly callback?: () => R,
    ) { }
}

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


