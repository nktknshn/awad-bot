import { IncomingMessage, Message, MessageDocument } from "telegraf/typings/telegram-types";
import { FileElement } from "./elements";
import { TextMessage } from "./messages";


export type RenderedElement = UserMessage | BotMessage | BotDocumentMessage;

export class UserMessage {
    kind: 'UserMessage' = 'UserMessage';
    constructor(
        readonly output: IncomingMessage
    ) { }
}

export class BotMessage {
    kind: 'BotMessage' = 'BotMessage';
    constructor(
        readonly input: TextMessage,
        readonly output: Message
    ) { }
}

export class BotDocumentMessage {
    kind: 'BotDocumentMessage' = 'BotDocumentMessage';
    constructor(
        readonly input: FileElement,
        readonly output: MessageDocument
    ) { }
}
