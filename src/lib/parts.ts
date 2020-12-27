import { Markup } from "telegraf"
import { ExtraReplyMessage, IncomingMessage, Message, MessageDocument } from "telegraf/typings/telegram-types"
import { ButtonElement, ButtonsRowElement, FileElement, InputHandlerData, Keyboard, RequestLocationButton } from "./types"
import { enumerateListOfLists, flattenList } from "./util"

export type Part = TextMessage | InputHandler | ActionsHandler | Effect | FileElement

// type Kinds = 'TextMessage' | 'InputHandler' | 'ActionsHandler' | 'Effect' | 'FileElement'

export class Effect {
    kind: 'Effect' = 'Effect'
    constructor(
        readonly callback: () => Promise<void>
    ) { }
}

export class TextMessage {
    kind: 'TextMessage' = 'TextMessage'
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
        return new TextMessage(
            this.text,
            [...this.buttons],
            [...this.keyboardButtons, btn],
            this.isComplete
        )
    }

    addButton(btn: ButtonElement) {
        let buttons = [...this.buttons.map(_ => [..._])]

        if (!buttons.length) {
            buttons.push([])
        }

        buttons[0].push(btn)

        return new TextMessage(
            this.text,
            buttons,
            this.keyboardButtons
        )

    }
    addButtonsRow(btns: ButtonsRowElement) {
        let buttons = [...this.buttons.map(_ => [..._])]
        buttons.push(btns.buttons)

        return new TextMessage(
            this.text,
            buttons,
            this.keyboardButtons
        )
    }
}


export class ActionsHandler {
    kind: 'ActionsHandler' = 'ActionsHandler'
    constructor(
        readonly callback: (input: string) => Promise<void>
    ) { }
}



export class InputHandler {
    kind: 'InputHandler' = 'InputHandler'
    constructor(
        readonly callback: (
            input: InputHandlerData,
            next: () => Promise<boolean | void>
        ) => Promise<boolean | void>
    ) { }
}

export type RenderedElement = UserMessage | BotMessage | BotDocumentMessage

export class UserMessage {
    kind: 'UserMessage' = 'UserMessage'
    constructor(
        readonly message: IncomingMessage,
    ) { }
}

export class BotMessage {
    kind: 'BotMessage' = 'BotMessage'
    constructor(
        readonly textMessage: TextMessage,
        readonly message: Message,
    ) { }
}

export class BotDocumentMessage {
    kind: 'BotDocumentMessage'= 'BotDocumentMessage'
    constructor(
        readonly element: FileElement,
        readonly message: MessageDocument,
    ) { }
}
