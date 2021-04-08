import { EffectElement, FileElement, InputHandlerElement } from "./elements"

export class InputHandler {
    kind: 'InputHandler' = 'InputHandler'
    constructor(public readonly  element: InputHandlerElement) {}
}

export class ActionsHandler {
    kind: 'ActionsHandler' = 'ActionsHandler'
}

export class FileMessage {
    kind: 'FileMessage' = 'FileMessage'
    constructor(public readonly  element: FileElement) {}
}

export class Effect {
    kind: 'Effect' = 'Effect'
    constructor(public readonly  element: EffectElement) {}

}