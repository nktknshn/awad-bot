import { isArray, isBoolean } from "util"
import { flattenList, makeKeyboardRows } from "../util"
import { Callback, Message, InputHandler, Row } from './types'
import { IncomingMessage, Message as TelegramMessage, ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { ChatUI } from './chatui'

export function Read(props: {
    text: string,
    onInput: Callback
}) {
    return [
        Message(props.text),
        OnInput(props.onInput)
    ]
}

export function OnInput(callback: Callback): InputHandler {
    return {
        kind: 'input',
        callback
    }
}

export function Message(
    text: (string | string[]),
    onDelete?: () => void,
    onReply?: () => void,
): Message {
    return constructMessage(isArray(text) ? text.join('\n') : text)
}

export function Buttons<S>(
    text: string | string[],
    rows: Row[],
    callback: Callback): Message {

    const rowsData = rows.map(row =>
        row.map(v => isArray(v) ? v : [v, v] as [string, string])
    )

    return constructMessage(
        isArray(text) ? text.join('\n') : text,
        makeKeyboardRows(rowsData).extra(),
        flattenList(rowsData).map(([_, data]) => [data, callback])
    )
}

export function constructMessage(
    text: string,
    extra?: ExtraReplyMessage,
    callbacks?: [string, Callback][]
): Message {

    text = text || '<empty>'

    return {
        kind: 'message',
        text,
        extra,
        async render<S>(chatUI: ChatUI<S>, target?: TelegramMessage) {
            if (target) {
                const ret = await chatUI.telegram
                    .editMessageText(
                        chatUI.chatId,
                        target.message_id,
                        undefined,
                        text,
                        extra)

                if (!isBoolean(ret))
                    return ret
            }

            return await chatUI.telegram.sendMessage(
                chatUI.chatId,
                this.text,
                extra)
        },
        callbacks: callbacks ?? []
    }
}


export function SelectionRow(
    row: string[],
    selectedIdx?: number,
    onClick?: () => void
) {
    return row
}
