// import { parseFromContext } from "../bot/bot-utils"
import { ActionsHandler, Effect, InputHandler } from "./elements"
import { parseFromContext } from './bot-util'
import { InputFile } from "telegraf/typings/telegram-types"

export type AppType<P> = (props: P) => ComponentGenerator
export type ComponentGenerator = Generator<ComponentElement, void, void>

export function isGenerator(compel: ComponentElement): compel is ComponentGenerator {
    return Symbol.iterator in Object(compel)
}

export type SimpleElement = TextElement | TextElementPart | NextMessage | ButtonElement | ButtonsRowElement | InputHandler | RequestLocationButton | ActionsHandler | Effect | FileElement | Keyboard

export type ComponentElement = SimpleElement | ComponentGenerator

export type InputHandlerData = ReturnType<typeof parseFromContext>

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

