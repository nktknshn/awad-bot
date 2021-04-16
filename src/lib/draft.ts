import { EffectElement, FileElement, InputHandlerElement } from "./elements"

export class InputHandler<R> {
    kind: 'InputHandler' = 'InputHandler'
    constructor(public readonly  element: InputHandlerElement<R>) {}
}

export class ActionsHandler {
    kind: 'ActionsHandler' = 'ActionsHandler'
}

export class OutcomingFileMessage {
    kind: 'FileMessage' = 'FileMessage'
    constructor(public readonly  element: FileElement) {}
}

export class Effect<R> {
    kind: 'Effect' = 'Effect'
    constructor(public readonly  element: EffectElement<R>) {}

}