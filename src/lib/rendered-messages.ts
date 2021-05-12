import { Message, MessageDocument, MessagePhoto } from "telegraf/typings/telegram-types";
import { RenderedMediaGroup } from "../bot3/mediagroup";
import { OutcomingFileMessage } from "./draft";
import { OutcomingMessageType } from "./elements-to-messages";
import { OutcomingTextMessage } from "./textmessage";
import { RenderedUserMessage } from './usermessage';

export type RenderedElement = RenderedUserMessage | BotMessage | BotDocumentMessage | RenderedMediaGroup


export class BotMessage {
    kind: 'BotMessage' = 'BotMessage';
    constructor(
        readonly input: OutcomingTextMessage<any>,
        readonly output: Message
    ) { }
    
    canReplace = (other: OutcomingMessageType) => other.kind === 'TextMessage'
        && this.input.keyboardButtons.length == 0
        && other.keyboardButtons.length == 0

    outputIds = () => [this.output.message_id]
}

export class BotDocumentMessage {
    kind: 'BotDocumentMessage' = 'BotDocumentMessage';
    canReplace = (other: OutcomingMessageType) => false
    constructor(
        readonly input: OutcomingFileMessage,
        readonly output: MessageDocument | MessagePhoto
    ) { }

    outputIds = () => [this.output.message_id]
}
