import { IncomingMessage, Message, MessageDocument, MessagePhoto } from "telegraf/typings/telegram-types";
import { FileElement } from "./elements";
import { OutcomingTextMessage } from "./messages";
import { OutcomingFileMessage } from "./draft";
import { OutcomingPhotoGroupMessage, RenderedMediaGroup } from "../bot3/mediagroup";
import { OutcomingMessageType } from "./elements-to-messages";
import {UserMessageElement, RenderedUserMessage} from './usermessage'
export type RenderedElement = RenderedUserMessage | BotMessage | BotDocumentMessage | RenderedMediaGroup


export class BotMessage {
    kind: 'BotMessage' = 'BotMessage';
    canReplace = (other: OutcomingMessageType) => other.kind === 'TextMessage'
    constructor(
        readonly input: OutcomingTextMessage,
        readonly output: Message
    ) { }
}

export class BotDocumentMessage {
    kind: 'BotDocumentMessage' = 'BotDocumentMessage';
    canReplace = (other: OutcomingMessageType) => false
    constructor(
        readonly input: OutcomingFileMessage,
        readonly output: MessageDocument | MessagePhoto
    ) { }
}
