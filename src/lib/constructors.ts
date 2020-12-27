import { Markup } from "telegraf"
import { InputFile } from "telegraf/typings/telegram-types"
import { ActionsHandler, Effect, InputHandler } from "./parts"
import { ButtonElement, ButtonsRowElement, TextElement, InputHandlerData, RequestLocationButton, FileElement, TextElementPart, NextMessage } from "./types"


export function startAwareInput(
    onStart: () => Promise<void>,
) {
    return (callback: (data: InputHandlerData) => Promise<boolean | void>) =>
        input(
            async (data) => {
                console.log(`data.messageText= ${data.messageText}`)

                if (data.messageText && data.messageText == '/start') {
                    console.log('/start caught')
                    return await onStart()
                } else {
                    return await callback(data)
                }
            }
        )
}


export function file(f: InputFile) {
    return new FileElement(f)
}

export function effect(callback: () => Promise<void>) {
    return new Effect(callback)
}

export function actionHandler(callback: (data: string) => Promise<void>) {
    return new ActionsHandler(callback)
}

export function input(callback: (data: InputHandlerData, next: () => Promise<boolean | void>) => Promise<boolean | void>) {
    return new InputHandler(callback)
}

export function message(text: string | string[]) {
    if (Array.isArray(text))
        text = text.join('\n')

    return new TextElement(text)
}

export function messagePart(text: string | string[]) {
    if (Array.isArray(text))
        text = text.join('\n')

    return new TextElementPart(text)
}

export function nextMessage() {
    return new NextMessage()
}

export function locationButton(text: string) {
    return new RequestLocationButton(text)
}

export function button(text: (string | [string, string]), callback: () => Promise<void>) {
    let [buttonText, data] = Array.isArray(text) ? text : [text, text]
    return new ButtonElement(buttonText, data, callback)
}

export function radioRow(
    options: (string | [string, string])[],
    callback: (idx: number, data: string) => Promise<void>,
    checked?: string) {

    const rowsData =
        options.map(v => Array.isArray(v) ? v : [v, v] as [string, string])

    return buttonsRow(
        rowsData.map(([opt, data], idx) => data == checked ? [`✅ ${opt}`, data] : [opt, data]),
        callback
    )
}

export function buttonsRow(texts: (string | [string, string])[], callback: (idx: number, data: string) => Promise<void>) {

    const rowsData =
        texts.map(v => Array.isArray(v) ? v : [v, v] as [string, string])

    return new ButtonsRowElement(
        [
            ...rowsData.map(([text, data], idx) =>
                button(text, () => callback(idx, data)))
        ]
    )
}
