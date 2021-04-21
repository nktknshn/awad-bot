import { Markup } from "telegraf"
import { ExtraReplyMessage } from "telegraf/typings/telegram-types"
import { parseFromContext } from "./bot-util"
import { ButtonElement, ButtonsRowElement, FileElement, KeyboardElement, RequestLocationButtonElement } from "./elements"
import { enumerateListOfLists, flattenList } from "./util"

export type InputHandlerData = ReturnType<typeof parseFromContext>

export class OutcomingTextMessage {
    kind: 'TextMessage' = 'TextMessage'
    constructor(
        readonly text?: string,
        readonly buttons: ButtonElement[][] = [],
        readonly keyboardButtons: (RequestLocationButtonElement | KeyboardElement)[] = [],
        readonly isComplete = false
    ) { }

    complete() {
        return new OutcomingTextMessage(
            this.text,
            this.buttons,
            this.keyboardButtons,
            true
        )
    }

    concatText(data: string) {
        return new OutcomingTextMessage(
            [(this.text ?? ''), data].join('\n'),
            this.buttons,
            this.keyboardButtons
        )
    }

    callback2<R>(data: string): R  | undefined {
        const button = flattenList(this.buttons).find(
            btn => (btn.data ?? btn.text) == data
        )

        if (button && button.callback) {
            return button.callback()
        }
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

    addKeyboardButton(btn: RequestLocationButtonElement) {
        return new OutcomingTextMessage(
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

        return new OutcomingTextMessage(
            this.text,
            buttons,
            this.keyboardButtons
        )

    }
    addButtonsRow(btns: ButtonsRowElement) {
        let buttons = [...this.buttons.map(_ => [..._])]
        buttons.push(btns.buttons)

        return new OutcomingTextMessage(
            this.text,
            buttons,
            this.keyboardButtons
        )
    }
}
