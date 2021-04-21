import { mediaGroup, PhotoGroupElement } from "../bot3/mediagroup"
import { BasicElement, EffectElement, FileElement, InputHandlerElement } from "./elements"
import { elementsToMessagesAndHandlers, emptyDraft, RenderDraft } from "./elements-to-messages"
import { InputHandlerElementF, InputHandlerF } from "./handlerF"
import { UserMessageElement, usermessage } from "./usermessage"

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

export function createDraftWithImages<AppAction extends any>(
    elements: (BasicElement | PhotoGroupElement| UserMessageElement )[]
): RenderDraft<AppAction> {
    const draft = emptyDraft<AppAction>()
    const inputHandlersF: InputHandlerF<AppAction>[] = []

    function handle(compel: BasicElement | PhotoGroupElement| UserMessageElement) {
        if (compel.kind === 'PhotoGroupElement') {
            mediaGroup.appendDraft(draft, compel)
        }
        else if (compel.kind === 'UserMessageElement') {
            usermessage.appendDraft(draft, compel)
        }
        else {
            elementsToMessagesAndHandlers<AppAction>(compel, draft)
        }
    }

    for (const compel of elements) {
        handle(compel)
    }

    return { ...draft }
}
