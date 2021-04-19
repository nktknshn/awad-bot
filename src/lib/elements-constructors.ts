import { Markup } from "telegraf"
import { InputFile } from "telegraf/typings/telegram-types"
import { InputHandlerData } from "./messages"
import { ButtonElement, ButtonsRowElement, TextElement, RequestLocationButtonElement, FileElement, TextPartElement, NextMessageElement, EffectElement, ActionsHandlerElement, InputHandlerElement } from "./elements"


export function file(f: InputFile) {
    return new FileElement(f)
}


export function photo(f: InputFile) {
    return new FileElement(f, true)
}

export function effect<R>(callback: () => R) {
    return new EffectElement(callback)
}

export function actionHandler(callback: (data: string) => Promise<void>) {
    return new ActionsHandlerElement(callback)
}

export function input<R>(callback: (data: InputHandlerData, next: () => R | undefined) => R | undefined) {
    return new InputHandlerElement<R>(callback)
}

export function message(text: string | string[]) {
    if (Array.isArray(text))
        text = text.join('\n')

    return new TextElement(text)
}

export function messagePart(text: string | string[]) {
    if (Array.isArray(text))
        text = text.join('\n')

    return new TextPartElement(text)
}

export function nextMessage() {
    return new NextMessageElement()
}

export function locationButton(text: string) {
    return new RequestLocationButtonElement(text)
}

export function button<R>(
    text: (string | [string, string]),
    callback: () => R
) {

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

export function buttonsRow(
    texts: (string | [string, string])[],
    callback: (idx: number, data: string) => Promise<void>
) {

    const rowsData =
        texts.map(v => Array.isArray(v) ? v : [v, v] as [string, string])

    return new ButtonsRowElement(
        [
            ...rowsData.map(([text, data], idx) =>
                button(text, () => callback(idx, data)))
        ]
    )
}
