import { ActionsHandler, Effect, InputHandler, TextMessage } from "./parts"
import { TextElement, ButtonElement, ButtonsRowElement, ComponentGenerator, RequestLocationButton, FileElement, Keyboard, Element, TextElementPart, NextMessage, isGenerator, SimpleElement, isComponentElement } from "./types"
import { lastItem } from "./util"

export type MsgType = (TextMessage | FileElement)
type Handler = InputHandler | ActionsHandler

type MessagesAndHandlers = {
    messages: MsgType[],
    handlers: Handler[],
    effects: Effect[],
    keyboards: Keyboard[]
}

export function elementsToMessagesAndHandlers(
    elements: SimpleElement[],
): MessagesAndHandlers {

    console.log(`componentToMessagesAndHandlers`);

    let index = 0;
    let messages: MsgType[] = []
    let handlers: Handler[] = []
    let effects: Effect[] = []
    let keyboards: Keyboard[] = []

    const lastMessage = (): {
        idx: number,
        message: TextMessage
    } => {
        const res = filterMapTextMessages(messages)
        if (!res.length) {
            const message = new TextMessage()
            messages.push(message)
            return {
                idx: messages.length - 1,
                message
            }
        }
        else {
            return res[res.length - 1]
        }
    }

    const setLastMessage = (message: TextMessage) => {
        messages[messages.length - 1] = message
    }

    const firstMessage = () => {
        const res = filterTextMessages(messages)
        return res[0]
    }

    for (const compel of elements) {
        if (compel.kind === 'InputHandler') {
            handlers.push(compel)
        }
        else if (compel.kind === 'ActionsHandler') {
            handlers.push(compel)
        }
        else if (compel.kind === 'RequestLocationButton') {
            setLastMessage(
                lastMessage().message.addKeyboardButton(compel)
            )
        }
        else if (compel.kind === 'ButtonElement') {
            setLastMessage(
                lastMessage().message.addButton(compel)
            )
        }
        else if (compel.kind === 'ButtonsRowElement') {
            setLastMessage(
                lastMessage().message.addButtonsRow(compel)
            )
        }
        else if (compel.kind === 'TextElement') {
            messages.push(new TextMessage(compel.text))
            continue
        }
        else if (compel.kind === 'TextElementPart') {
            const { message, idx } = lastMessage()
            if (!message.isComplete)
                setLastMessage(message.concatText(compel.text))
            else
                messages.push(new TextMessage(compel.text))
            continue
        }
        else if (compel.kind === 'NextMessage') {
            const { message, idx } = lastMessage()
            setLastMessage(message.complete())
            continue
        }
        else if (compel.kind === 'Effect') {
            effects.push(compel)
            continue
        }
        else if (compel.kind === 'FileElement') {
            messages.push(compel)
            continue
        }
        else if (compel.kind === 'Keyboard') {
            // messages.push(compel)
            // if (!lastMessage()) {
            //     messages.push(new TextMessage())
            // }
            // lastMessage().addKeyboardButton(compel)
            keyboards.push(compel)
            continue
        }
        else {
            // will never return if all kinds checked
            return compel
        }

        index += 1
    }

    return { messages, handlers, effects, keyboards }
}

export function filterTextMessages(messages: MsgType[]) {
    return messages.filter((_): _ is TextMessage => _.kind === 'TextMessage')
}

import { filterMapWithIndex } from 'fp-ts/Array'
import { some, none } from 'fp-ts/Option'

export function filterMapTextMessages(messages: MsgType[]) {
    return filterMapWithIndex((idx, message: MsgType) =>
        message.kind === 'TextMessage'
            ? some({ idx, message })
            : none)(messages)
}
