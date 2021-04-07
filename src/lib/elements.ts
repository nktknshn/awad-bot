// import { parseFromContext } from "../bot/bot-utils"
import { InputFile } from "telegraf/typings/telegram-types"
import { MessagesAndHandlers } from "./elements-to-messages"
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
    return el.kind === 'component'
        || el.kind === 'component-with-state-connected'
        || el.kind === 'component-with-state'
}

export type GetSetState<S> = {
    getState: (initialState?: S) => S
    setState: (state: Partial<S>) => Promise<void>
}

export type ComponentGenerator = Generator<Element, void, void>

type CompConstructor<P, R> = ((props: P) => R)

export type CompConstructorWithState<P, S = never, R = ComponentGenerator> =
    (props: P, getset: GetSetState<S>) => R

export interface ComponentStateless<P, R = ComponentGenerator> {
    cons: CompConstructor<P, R>
    props: P,
    kind: 'component'
}

export interface ComponentWithState<P, S = never, R = ComponentGenerator> {
    cons: CompConstructorWithState<P, S, R>
    props: P,
    kind: 'component-with-state'
}

export interface ComponentConnected<P extends M, S, M, RootState, R = ComponentGenerator> {
    cons: CompConstructorWithState<P, S, R>
    mapper: (state: RootState) => M
    props: Subtract<P, M>
    kind: 'component-with-state-connected'
}

export type ComponentElement =
    | ComponentStateless<any>
    | ComponentWithState<any, any>
    | ComponentConnected<any, any, any, any>

export function Component<P, S, R= ComponentGenerator>(cons: CompConstructorWithState<P, S, R>) {
    return function (props: P): ComponentWithState<P, S, R> {
        return {
            cons,
            props,
            kind: 'component-with-state'
        }
    }
}

export function ConnectedComp<P extends M, S, M, State, R>(
    cons: CompConstructorWithState<P, S, R>,
    mapper: (state: State) => M,
): (props: Subtract<P, M>) => ComponentConnected<P, S, M, State, R> {
    return function (props: Subtract<P, M>): ComponentConnected<P, S, M, State, R> {
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

interface Appliable {
    apply(draft: MessagesAndHandlers): MessagesAndHandlers
}

const buttonElementApply = (b: ButtonElement) => (d: MessagesAndHandlers) => {
    return {
        ...d
    }
}

export class ButtonElement implements Appliable {
    kind: 'ButtonElement' = 'ButtonElement'
    constructor(
        readonly text: string,
        readonly data?: string,
        readonly callback?: () => Promise<void>,
    ) { }

    public apply = buttonElementApply(this)
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

