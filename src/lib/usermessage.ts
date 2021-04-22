import { IncomingMessage } from "telegraf/typings/telegram-types";
import { ChatRenderer } from "./chatrenderer";
import { wrapR } from "./elements";
import { OutcomingMessageType, RenderDraft } from "./elements-to-messages";
import { RenderedElement } from "./rendered-messages";

export class UserMessageElement {
    kind: 'UserMessageElement' = 'UserMessageElement'
    constructor(
        readonly messageId: number
    ) { }
}

export class OutcomingUserMessage {
    kind: 'OutcomingUserMessage' = 'OutcomingUserMessage'
    constructor(
        readonly el: UserMessageElement
    ) { }
}

export class RenderedUserMessage {
    kind: 'RenderedUserMessage' = 'RenderedUserMessage';
    canReplace = (other: OutcomingMessageType) => false
    constructor(
        readonly input: OutcomingUserMessage,
        readonly output: number
    ) { }
}


function remove(
    el: RenderedUserMessage,
) {
    return async function (renderer: ChatRenderer) {
        await renderer.delete(el.output)
    }
}

function create(
    newElement: OutcomingUserMessage,
) {
    return async function (renderer: ChatRenderer) {
        return new RenderedUserMessage(
            newElement,
            newElement.el.messageId
        )
    }
}

function areSameUserMessages(a: RenderedUserMessage, b: OutcomingUserMessage) {
    return a.output == b.el.messageId
}


export const addRenderedUserMessage = (messageId: number) => wrapR(rs =>
    [...rs, createRendered(messageId)])

export const createRendered = (messageId: number): RenderedElement => new RenderedUserMessage(
    new OutcomingUserMessage(
        new UserMessageElement(messageId)), messageId)


export const usermessage = {
    element: UserMessageElement,
    outcoming: OutcomingUserMessage,
    rendered: RenderedUserMessage,
    equals: areSameUserMessages,
    actions: {
        remove,
        create
    },
    appendDraft: <H>(draft: RenderDraft<H>, el: UserMessageElement) => {
        draft.messages.push(
            new OutcomingUserMessage(el)
        )
    }
}
