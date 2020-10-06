import { Markup } from "telegraf"
import { ExtraReplyMessage, IncomingMessage, Message, MessageDocument } from "telegraf/typings/telegram-types"
import { ButtonElement, ButtonsRowElement, FileElement, InputHandlerData, Keyboard, RequestLocationButton } from "./types"
import { enumerateListOfLists, flattenList } from "./util"

export type Element = TextMessage | InputHandler | ActionsHandler | Effect | FileElement

export class Effect {
    constructor(
        readonly callback: () => Promise<void>
    ) { }
}


export class TextMessage {
    constructor(
        readonly text?: string,
        readonly buttons: ButtonElement[][] = [],
        readonly keyboardButtons: (RequestLocationButton | Keyboard)[] = [],
        readonly isComplete = false
    ) { }
    
    complete() {
        return new TextMessage(
            this.text,
            this.buttons,
            this.keyboardButtons,
            true
        )
    }

    concatText(data: string) {
        return new TextMessage(
            [(this.text ?? ''), data].join('\n'),
            this.buttons,
            this.keyboardButtons
        )
    }

    async callback(data: string): Promise<boolean> {
        const button = flattenList(this.buttons).find(
            btn => (btn.data ?? btn.text) == data
        )

        if (button && button.callback) {
            await button.callback()
            return true
        }
        return false
    }

    getExtra(): ExtraReplyMessage {
        if (this.keyboardButtons.length) {
            return Markup.keyboard(
                this.keyboardButtons
                    .map(btn => Markup.button(btn.text, btn.hide))
            )
                .resize(true)
                .oneTime(true).extra()
        }

        return Markup.inlineKeyboard(
            enumerateListOfLists(this.buttons).map(row =>
                row.map(([btn, idx]) =>
                    Markup.callbackButton(
                        btn.text, btn.data ?? btn.text
                        // btn.text, String(idx)
                    )
                )
            )
        ).extra()
    }

    addKeyboardButton(btn: RequestLocationButton) {
        this.keyboardButtons.push(btn)
    }

    addButton(btn: ButtonElement) {
        if (!this.buttons.length) {
            this.buttons.push([])
        }
        this.buttons[0].push(btn)
    }
    addButtonsRow(btns: ButtonsRowElement) {
        this.buttons.push(btns.buttons)
    }

    // addKeyboard(kbd: Keyboard) {

    // }
}


export class ActionsHandler {
    constructor(
        readonly callback: (input: string) => Promise<void>
    ) {

    }
}

export class InputHandler {
    constructor(
        readonly callback: (
            input: InputHandlerData,
            next: () => Promise<boolean | void>
        ) => Promise<boolean | void>
    ) {
    }
}

export type RenderedElement = UserMessage | BotMessage | BotDocumentMessage

export class UserMessage {
    constructor(
        readonly message: IncomingMessage,
    ) {

    }
}

export class BotMessage {
    constructor(
        readonly textMessage: TextMessage,
        readonly message: Message,
    ) {

    }
}

export class BotDocumentMessage {
    constructor(
        readonly element: FileElement,
        readonly message: MessageDocument,
    ) {

    }
}
