// import { parseFromContext } from "../bot/bot-utils"
import { ActionsHandler, Effect, InputHandler } from "./elements"
import { parseFromContext } from './bot-util'
import { InputFile } from "telegraf/typings/telegram-types"

export type AppType<P> = (props: P) => ComponentGenerator
export type ComponentGenerator = Generator<ComponentElement, void, void>
export type ComponentElement =
    TextElement | TextElementPart | NextMessage | ButtonElement | ButtonsRowElement | InputHandler | ComponentGenerator | RequestLocationButton | ActionsHandler | Effect | FileElement | Keyboard

export type InputHandlerData = ReturnType<typeof parseFromContext>

export class Keyboard {
    constructor(readonly text: string, readonly hide: boolean = true) { }
}

export class RequestLocationButton {
    constructor(readonly text: string, readonly hide: boolean = true) { }
}

export class TextElement {
    constructor(
        readonly text: string
    ) { }
}

export class TextElementPart {
    constructor(
        readonly text: string
    ) { }
}

export class NextMessage {
    constructor() { }
}

export class ButtonElement {
    constructor(
        readonly text: string,
        readonly data?: string,
        readonly callback?: () => Promise<void>,
    ) { }
}

export class ButtonsRowElement {
    constructor(
        readonly buttons: ButtonElement[] = []
    ) { }
}

export class FileElement {
    constructor(
        readonly file: InputFile
    ) { }
}

