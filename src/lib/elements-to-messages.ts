import { filterMapWithIndex } from 'fp-ts/Array'
import { none, some } from 'fp-ts/Option'
import { ActionsHandler, Effect, InputHandler, TextMessage } from "./messages"
import { FileElement, Keyboard, BasicElement } from "./elements"

export type MessageType = (TextMessage | FileElement)

type HandlerType = InputHandler | ActionsHandler

export type MessagesAndHandlers = {
    messages: MessageType[],
    handlers: HandlerType[],
    effects: Effect[],
    keyboards: Keyboard[]
    inputHandlers: InputHandler[]
}

export function elementsToMessagesAndHandlers2(elements: BasicElement[]) {

}


interface RenderDraft {

}

export function elementsToMessagesAndHandlers(
    elements: BasicElement[],
): MessagesAndHandlers {

    console.log(`componentToMessagesAndHandlers`);

    let index = 0;
    let messages: MessageType[] = []
    let handlers: HandlerType[] = []
    let effects: Effect[] = []
    let keyboards: Keyboard[] = []
    let inputHandlers: InputHandler[] = []

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
            inputHandlers.push(compel)
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

    return { messages, handlers, effects, keyboards, inputHandlers }
}

export function filterTextMessages(messages: MessageType[]) {
    return messages.filter((_): _ is TextMessage => _.kind === 'TextMessage')
}


export function filterMapTextMessages(messages: MessageType[]) {
    return filterMapWithIndex((idx, message: MessageType) =>
        message.kind === 'TextMessage'
            ? some({ idx, message })
            : none)(messages)
}
