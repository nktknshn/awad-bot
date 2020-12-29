// import { parseFromContext } from "../bot/bot-utils"
import { InputFile } from "telegraf/typings/telegram-types"
import { ActionsHandler, Effect, InputHandler } from "./messages"

type Diff<T, U> = T extends U ? never : T

export type Subtract<T1 extends T2, T2> = {
    [P in Diff<keyof T1, keyof T2>]: T1[P]
}

export type AppType<P> = (props: P) => ComponentGenerator

// export function isGenerator(compel: Element): compel is ComponentConstructor {
//     return Symbol.iterator in Object(compel)
// }

export type BasicElement = TextElement | TextElementPart | NextMessage | ButtonElement | ButtonsRowElement | InputHandler | RequestLocationButton | ActionsHandler | Effect | FileElement | Keyboard

export type Element = BasicElement | ComponentElement

export function isComponentElement(el: Element): el is ComponentElement {
    return 'comp' in el
}

export type GetSetState<S> = {
    getState: (initialState?: S) => S
    setState: (state: Partial<S>) => Promise<void>
}

export type ComponentGenerator = Generator<Element, void, void>

type CompConstructor<P> = ((props: P) => ComponentGenerator)

export type CompConstructorWithState<P, S = never> =
    (props: P, getset: GetSetState<S>) => ComponentGenerator

export interface ComponentStateless<P> {
    cons: CompConstructor<P>
    props: P,
    kind: 'component'
}

export interface ComponentWithState<P, S = never> {
    cons: CompConstructorWithState<P, S>
    props: P,
    kind: 'component-with-state'
}

export interface ComponentConnected<P extends M, S, M, RootState> {
    cons: CompConstructorWithState<P, S>
    mapper: (state: RootState) => M
    props: Subtract<P, M>
    kind: 'component-with-state-connected'
}

export type ComponentElement =
    | ComponentStateless<any>
    | ComponentWithState<any, any>
    | ComponentConnected<any, any, any, any>

export function Component<P, S>(cons: CompConstructorWithState<P, S>) {
    return function (props: P): ComponentWithState<P, S> {
        return {
            cons,
            props,
            kind: 'component-with-state'
        }
    }
}

export function ConnectedComp<P extends M, S, M, State>(
    cons: CompConstructorWithState<P, S>,
    mapper: (state: State) => M,
): (props: Subtract<P, M>) => ComponentConnected<P, S, M, State> {
    return function (props: Subtract<P, M>): ComponentConnected<P, S, M, State> {
        return {
            cons,
            props,
            mapper,
            kind: 'component-with-state-connected'
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

