import { filterMapWithIndex } from 'fp-ts/Array'
import { none, some } from 'fp-ts/Option'
import { OutcomingTextMessage } from "./messages"
import { KeyboardElement, BasicElement, isAppliable } from "./elements"
import { OutcomingFileMessage, InputHandler, ActionsHandler, Effect } from './draft'
import { OutcomingPhotoGroupMessage } from '../bot3/mediagroup'
import { mylog } from './logging'

export type OutcomingMessageType = (OutcomingTextMessage | OutcomingFileMessage) | OutcomingPhotoGroupMessage

type HandlerType = InputHandler | ActionsHandler

export type RenderDraft = {
    messages: OutcomingMessageType[],
    handlers: HandlerType[],
    effects: Effect[],
    keyboards: KeyboardElement[],
    inputHandlers: InputHandler[]
}

// export type RenderDraft = MessagesAndHandlers

export const emptyDraft = (): RenderDraft => ({
    messages: [],
    handlers: [],
    effects: [],
    keyboards: [],
    inputHandlers: []
})

export const defaultCreateDraft = (elements: BasicElement[], d?: RenderDraft): RenderDraft => {

    const draft = d ?? emptyDraft()

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
): RenderDraft {

    mylog(`elementsToMessagesAndHandlers: ${compel.kind}`);

    let messages: OutcomingMessageType[] = draft.messages
    let handlers: HandlerType[] = draft.handlers
    let effects: Effect[] = draft.effects
    let keyboards: KeyboardElement[] = draft.keyboards
    let inputHandlers: InputHandler[] = draft.inputHandlers

    const lastMessage = (): {
        idx: number,
        message: OutcomingTextMessage
    } => {
        const res = filterMapTextMessages(messages)
        if (!res.length) {
            const message = new OutcomingTextMessage()
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

    const setLastMessage = (message: OutcomingTextMessage) => {
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
        messages.push(new OutcomingTextMessage(compel.text))
    }
    else if (compel.kind === 'TextElementPart') {
        const { message, idx } = lastMessage()
        if (!message.isComplete)
            setLastMessage(message.concatText(compel.text))
        else
            messages.push(new OutcomingTextMessage(compel.text))
    }
    else if (compel.kind === 'NextMessage') {
        const { message, idx } = lastMessage()
        setLastMessage(message.complete())
    }
    else if (compel.kind === 'EffectElement') {
        effects.push(new Effect(compel))
    }
    else if (compel.kind === 'FileElement') {
        messages.push(new OutcomingFileMessage(compel))
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

export function filterTextMessages(messages: OutcomingMessageType[]) {
    return messages.filter((_): _ is OutcomingTextMessage => _.kind === 'TextMessage')
}


export function filterMapTextMessages(messages: OutcomingMessageType[]) {
    return filterMapWithIndex((idx, message: OutcomingMessageType) =>
        message.kind === 'TextMessage'
            ? some({ idx, message })
            : none)(messages)
}
