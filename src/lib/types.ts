// import { parseFromContext } from "../bot/bot-utils"
import { ActionsHandler, Effect, InputHandler } from "./parts"
import { parseFromContext } from './bot-util'
import { InputFile } from "telegraf/typings/telegram-types"

export type AppType<P> = (props: P) => ComponentGenerator

export function isGenerator(compel: Element): compel is ComponentElement {
    return Symbol.iterator in Object(compel)
}

export type SimpleElement = TextElement | TextElementPart | NextMessage | ButtonElement | ButtonsRowElement | InputHandler | RequestLocationButton | ActionsHandler | Effect | FileElement | Keyboard

export type Element = SimpleElement | ComponentElement

export function isComponentElement(el: Element): el is ComponentElement {
    return 'comp' in el
} 

export type InputHandlerData = ReturnType<typeof parseFromContext>

export type GetSetState<S> = {
    getState: (initialState?: S) => S
    setState: (state: Partial<S>) => Promise<void>
}

// type ComponentGenerator<R> = Generator<R, unknown, unknown>
export type ComponentGenerator = Generator<Element, void, void>

type CompConstructor<P> = ((props: P) => ComponentGenerator)

type CompConstructorWithState<P, S = never> = (props: P, getset: GetSetState<S>) => ComponentGenerator

export interface ComponentStateless<P> {
    comp: CompConstructor<P>
    props: P,
    kind: 'component'
}

export interface ComponentWithState<P, S = never> {
    comp: CompConstructorWithState<P, S>
    props: P,
    kind: 'component-with-state'
}

export type ComponentElement =
    | ComponentStateless<any>
    | ComponentWithState<any, any>


export function Component<P>(comp: CompConstructor<P>) {
    return function (props: P): ComponentStateless<P> {
        return {
            comp,
            props,
            kind: 'component'
        }
    }
}


export function ComponentWithState<P, S>(comp: CompConstructorWithState<P, S>) {
    return function (props: P): ComponentWithState<P, S> {
        return {
            comp,
            props,
            kind: 'component-with-state'
        }
    }
}

export class Keyboard {
    kind: 'Keyboard' = 'Keyboard'
    constructor(readonly text: string, readonly hide: boolean = true) { }
}

export class RequestLocationButton {
    kind: 'RequestLocationButton' = 'RequestLocationButton'
    constructor(readonly text: string, readonly hide: boolean = true) { }
}

export class TextElement {
    kind: 'TextElement' = 'TextElement'
    constructor(
        readonly text: string
    ) { }
}

export class TextElementPart {
    kind: 'TextElementPart' = 'TextElementPart'
    constructor(
        readonly text: string
    ) { }
}

export class NextMessage {
    kind: 'NextMessage' = 'NextMessage'
    constructor() { }
}

export class ButtonElement {
    kind: 'ButtonElement' = 'ButtonElement'
    constructor(
        readonly text: string,
        readonly data?: string,
        readonly callback?: () => Promise<void>,
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
        readonly file: InputFile
    ) { }
}

