// import { parseFromContext } from "../bot/bot-utils"
import { InputFile } from "telegraf/typings/telegram-types"
import { MessagesAndHandlers } from "./elements-to-messages"
import { InputHandlerData } from "./messages"

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
    Appliable 
    | TextElement 
    | TextPartElement 
    | NextMessageElement 
    | ButtonElement 
    | ButtonsRowElement 
    | InputHandlerElement
    | RequestLocationButtonElement 
    | ActionsHandlerElement 
    | EffectElement
    | FileElement 
    | KeyboardElement

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

export type ComponentGenerator = Generator<any, void, void>

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
    id?: string
}

export type ComponentElement =
    | ComponentStateless<any>
    | ComponentWithState<any, any>
    | ComponentConnected<any, any, any, any>
    | ComponentConnected<any, any, any, any, any>

export function Component<P, S, R extends ComponentGenerator>(cons: CompConstructorWithState<P, S, R>) {
    return function (props: P): ComponentWithState<P, S, R> {
        return {
            cons,
            props,
            kind: 'component-with-state'
        }
    }
}

export function ConnectedComp<P extends M, S, M, State, R extends ComponentGenerator>(
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

export function connected1<P extends M, S, M, State, R extends ComponentGenerator>(
    mapper: (state: State) => M,
    cons: CompConstructorWithState<P, S, R>
) {
    return ConnectedComp(cons, mapper)
}

// export function Comp2<P extends M, S, M, State, R extends ComponentGenerator, PP>(
//     mapper: (state: State) => M,
//     cons: (props: PP) => CompConstructorWithState<P, S, R>
// ){   
//     return (props: PP) => ConnectedComp(cons(props), mapper)({} as any)
// }

export function connected2<P extends M, S, M, State, PP, R extends ComponentGenerator>(
    mapper: (state: State) => M,
    cons: (reqs: P) => (props: PP, getset: GetSetState<S>) => R
): (props: PP) => ComponentConnected<P & PP, S, M, State, R>
{   
    return (props: PP) => (
        {
            cons: (reqs: P, getset: GetSetState<S>) => cons(reqs)(props, getset),
            props: (props as unknown) as Subtract<P & PP, M>,
            mapper,
            kind: 'component-with-state-connected',
            id: cons.toString()
        }
    )
}


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
    apply(draft: MessagesAndHandlers): MessagesAndHandlers
}

export function isAppliable(b: BasicElement | Appliable) : b is Appliable {
    return 'apply' in b
}

const buttonElementApply = (b: ButtonElement) => (d: MessagesAndHandlers) => {
    return {
        ...d
    }
}

export class ButtonElement {
    kind: 'ButtonElement' = 'ButtonElement'
    constructor(
        readonly text: string,
        readonly data?: string,
        readonly callback?: () => Promise<void>,
    ) { }
    
    // public addContext<C>(ctx: C) {
    //     return new ButtonElement(this.text, this.data, () => this.callback(ctx))
    // }
    // public apply = buttonElementApply(this)
}

export class InputHandler2<D>
//  implements Appliable 
 {
    kind: 'InputHandler2' = 'InputHandler2'
    constructor(
        readonly callback: (
            input: InputHandlerData,
            next: () => Promise<boolean | void>,
            dispatcher: D
        ) => Promise<boolean | void>
    ) { }

    public apply = (draft: MessagesAndHandlers) => {
        return draft
    }
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

export class EffectElement {
    kind: 'EffectElement' = 'EffectElement'
    constructor(
        readonly callback: () => Promise<void>
    ) { }
}


export class ActionsHandlerElement {
    kind: 'ActionsHandlerElement' = 'ActionsHandlerElement'
    constructor(
        readonly callback: (input: string) => Promise<void>
    ) { }
}

export class InputHandlerElement {
    kind: 'InputHandlerElement' = 'InputHandlerElement'
    constructor(
        readonly callback: (
            input: InputHandlerData,
            next: () => Promise<boolean | void>,
        ) => Promise<boolean | void>
    ) { }
}


