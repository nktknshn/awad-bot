import { filterMapWithIndex } from 'fp-ts/Array'
import { none, some } from 'fp-ts/Option'
import { TextMessage } from "./messages"
import { KeyboardElement, BasicElement, isAppliable } from "./elements"
import { FileMessage, InputHandler, ActionsHandler, Effect } from './render'

export type MessageType = (TextMessage | FileMessage)

type HandlerType = InputHandler | ActionsHandler

export type MessagesAndHandlers = {
    messages: MessageType[],
    handlers: HandlerType[],
    effects: Effect[],
    keyboards: KeyboardElement[],
    inputHandlers: InputHandler[]
}

export type RenderDraft = MessagesAndHandlers

export const emptyDraft = (): RenderDraft => ({
    messages: [],
    handlers: [],
    effects: [],
    keyboards: [],
    inputHandlers: []
})

export const defaultCreateDraft = (elements: BasicElement[]): RenderDraft => {

    const draft = emptyDraft()

    function handle(compel: BasicElement) {
        elementsToMessagesAndHandlers(compel, draft)
    }

    for (const compel of elements) {
        handle(compel)
    }

    return draft
}


export function elementsToMessagesAndHandlers(
    compel: BasicElement,
    draft: RenderDraft
): MessagesAndHandlers {

    console.log(`componentToMessagesAndHandlers`);

    let messages: MessageType[] = draft.messages
    let handlers: HandlerType[] = draft.handlers
    let effects: Effect[] = draft.effects
    let keyboards: KeyboardElement[] = draft.keyboards
    let inputHandlers: InputHandler[] = draft.inputHandlers

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

    if (isAppliable(compel)) {
        compel.apply(draft)
    } 
    else if (compel.kind === 'InputHandlerElement') {
        // handlers.push(compel)
        inputHandlers.push(
            new InputHandler(compel)
        )
    }
    else if (compel.kind === 'ActionsHandlerElement') {
        // handlers.push(compel)
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
    }
    else if (compel.kind === 'TextElementPart') {
        const { message, idx } = lastMessage()
        if (!message.isComplete)
            setLastMessage(message.concatText(compel.text))
        else
            messages.push(new TextMessage(compel.text))
    }
    else if (compel.kind === 'NextMessage') {
        const { message, idx } = lastMessage()
        setLastMessage(message.complete())
    }
    else if (compel.kind === 'EffectElement') {
        effects.push(new Effect(compel))
    }
    else if (compel.kind === 'FileElement') {
        messages.push(new FileMessage(compel))
    }
    else if (compel.kind === 'Keyboard') {
        // messages.push(compel)
        // if (!lastMessage()) {
        //     messages.push(new TextMessage())
        // }
        // lastMessage().addKeyboardButton(compel)
        keyboards.push(compel)
    }
    else {
        // will never return if all kinds checked
        return compel
    }


    // return { messages, handlers, effects, keyboards, inputHandlers }
    return draft
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
