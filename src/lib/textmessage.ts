import { Markup } from "telegraf"
import { ExtraReplyMessage } from "telegraf/typings/telegram-types"
import { parseFromContext } from "./bot-util"
import { ButtonElement, ButtonsRowElement, FileElement, KeyboardButtonElement, RequestLocationButtonElement } from "./elements"
import { enumerateListOfLists, flattenList } from "./util"

export type InputHandlerData = ReturnType<typeof parseFromContext>

type KeyboardButton = RequestLocationButtonElement | KeyboardButtonElement

export class OutcomingTextMessage<H> {
    kind: 'TextMessage' = 'TextMessage'
    constructor(
        readonly text?: string,
        readonly buttons: ButtonElement<H>[][] = [],
        readonly keyboardButtons: KeyboardButton[] = [],
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

    callback2(data: string): H | undefined {
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
                    .map(btn =>
                        Array.isArray(btn.text)
                            ? btn.text.map(text => Markup.button(text, btn.hide))
                            : [Markup.button(btn.text, btn.hide)]))
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

    addKeyboardButton(btn: KeyboardButton) {
        return new OutcomingTextMessage(
            this.text,
            [...this.buttons],
            [...this.keyboardButtons, btn],
            this.isComplete
        )
    }

    addButton(btn: ButtonElement<H>) {
        let buttons = [...this.buttons.map(_ => [..._])]

        if (!buttons.length) {
            buttons.push([])
        }

        buttons[buttons.length - 1].push(btn)

        if(btn.nextLine)
            buttons.push([])

        return new OutcomingTextMessage(
            this.text,
            buttons,
            this.keyboardButtons
        )

    }
    addButtonsRow(btns: ButtonsRowElement<H>) {
        let buttons = [...this.buttons.map(_ => [..._])]
        buttons.push(btns.buttons)

        return new OutcomingTextMessage(
            this.text,
            buttons,
            this.keyboardButtons
        )
    }
}
