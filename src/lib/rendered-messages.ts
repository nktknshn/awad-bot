import { IncomingMessage, Message, MessageDocument, MessagePhoto } from "telegraf/typings/telegram-types";
import { FileElement } from "./elements";
import { TextMessage } from "./messages";
import { FileMessage } from "./render";

export type RenderedElement = UserMessage | BotMessage | BotDocumentMessage;

export class UserMessage {
    kind: 'UserMessage' = 'UserMessage';
    replacable = (other: TextMessage | FileMessage) => false
    constructor(
        readonly output: IncomingMessage
    ) { }
}

export class BotMessage {
    kind: 'BotMessage' = 'BotMessage';
    replacable = (other: TextMessage | FileMessage) => other.kind === 'TextMessage'
    constructor(
        readonly input: TextMessage,
        readonly output: Message
    ) { }
}

export class BotDocumentMessage {
    kind: 'BotDocumentMessage' = 'BotDocumentMessage';
    replacable = (other: TextMessage | FileMessage) => false
    constructor(
        readonly input: FileMessage,
        readonly output: MessageDocument | MessagePhoto
    ) { }
}
