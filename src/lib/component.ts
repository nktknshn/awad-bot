import { ActionsHandler, Effect, InputHandler, TextMessage } from "./elements"
import { TextElement, ButtonElement, ButtonsRowElement, ComponentGenerator, RequestLocationButton, FileElement, Keyboard, ComponentElement, TextElementPart, NextMessage } from "./types"
import { lastItem } from "./util"

export type MsgType = (TextMessage | FileElement)

export function componentToElements(component: ComponentGenerator) {
    let elementsList: ComponentElement[] = []

    for (const compel of component) {
        if (Symbol.iterator in Object(compel)) {

            // compel[Symbol.iterator]

            elementsList = [...elementsList, ...componentToElements(compel as ComponentGenerator)]
        } else {
            elementsList.push(compel)
        }
    }

    return elementsList
}

export function componentToMessagesAndHandlers(component: ComponentGenerator) {

    console.log(`componentToMessagesAndHandlers`);


    let messages: MsgType[] = []
    let handlers: (InputHandler | ActionsHandler)[] = []
    let effects: Effect[] = []
    let keyboards: Keyboard[] = []

    const lastMessage = () => {
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

    const firstMessage = () => {
        const res = filterTextMessages(messages)
        return res[0]
    }

    for (const compel of componentToElements(component)) {
        console.log(`compel: ${compel.constructor.name}`)

        // let last = messages.length ? messages[messages.length - 1] : undefined

        if (compel instanceof InputHandler) {
            handlers.push(compel)
        }
        else if (compel instanceof ActionsHandler) {
            handlers.push(compel)
        }
        else if (compel instanceof RequestLocationButton) {
            if (!lastMessage()) {
                messages.push(new TextMessage())
            }

            lastMessage().message.addKeyboardButton(compel)
        }
        else if (compel instanceof ButtonElement) {
            lastMessage().message.addButton(compel)
        }
        else if (compel instanceof ButtonsRowElement) {
            lastMessage().message.addButtonsRow(compel)
        }
        else if (compel instanceof TextElement) {
            messages.push(new TextMessage(compel.text))
            continue
        }
        else if (compel instanceof TextElementPart) {
            const { message, idx } = lastMessage()
            if (!message.isComplete)
                messages[idx] = message.concatText(compel.text)
            else
                messages.push(new TextMessage(compel.text))
            continue
        }
        else if (compel instanceof NextMessage) {
            const { message, idx } = lastMessage()
            messages[idx] = message.complete()
            continue
        }
        else if (compel instanceof Effect) {
            // messages.push(compel)
            effects.push(compel)
            continue
        }
        else if (compel instanceof FileElement) {
            messages.push(compel)
            continue
        }
        else if (compel instanceof Keyboard) {
            // messages.push(compel)
            // if (!lastMessage()) {
            //     messages.push(new TextMessage())
            // }
            // lastMessage().addKeyboardButton(compel)
            keyboards.push(compel)
            continue
        }
        else if (typeof compel[Symbol.iterator] === 'function') {
            const res = componentToMessagesAndHandlers(compel)

            messages = [...messages, ...res.messages]
            handlers = [...handlers, ...res.handlers]
            effects = [...effects, ...res.effects]
            keyboards = [...keyboards, ...res.keyboards]
        }
    }

    // if(keyboards.length) {
    //     firstMessage().addKeyboardButton(lastItem(keyboards)!)
    // }

    return { messages, handlers, effects, keyboards }
}

export function filterTextMessages(messages: MsgType[]) {
    return messages.filter((_): _ is TextMessage => _ instanceof TextMessage)
}


import { filterMapWithIndex } from 'fp-ts/Array'
import { some, none } from 'fp-ts/Option'

export function filterMapTextMessages(messages: MsgType[]) {
    return filterMapWithIndex((idx, message) =>
        message instanceof TextMessage
            ? some({ idx, message })
            : none)(messages)
}
