import { IncomingMessage, Message, MessageDocument, MessagePhoto } from "telegraf/typings/telegram-types";
import { FileElement } from "./elements";
import { OutcomingTextMessage } from "./messages";
import { OutcomingFileMessage } from "./draft";
import { OutcomingPhotoGroupMessage, RenderedMediaGroup } from "../bot3/mediagroup";
import { OutcomingMessageType } from "./elements-to-messages";

export type RenderedElement = UserMessage | BotMessage | BotDocumentMessage | RenderedMediaGroup

export class UserMessage {
    kind: 'UserMessage' = 'UserMessage';
    canReplace = (other: OutcomingMessageType) => false
    constructor(
        readonly output: IncomingMessage
    ) { }
}

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
