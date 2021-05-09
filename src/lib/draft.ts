import { mediaGroup, PhotoGroupElement } from "../bot3/mediagroup"
import { BasicElement, EffectElement, FileElement, InputHandlerElement } from "./elements"
import { elementsToMessagesAndHandlers, emptyDraft, RenderDraft } from "./elements-to-messages"
import { Matcher2 } from "./input"
import { usermessage, UserMessageElement } from "./usermessage"

export class InputHandler<R> {
    kind: 'InputHandler' = 'InputHandler'
    constructor(public readonly element: InputHandlerElement<R>) { }
}

export class ActionsHandler {
    kind: 'ActionsHandler' = 'ActionsHandler'
}

export class OutcomingFileMessage {
    kind: 'FileMessage' = 'FileMessage'
    constructor(public readonly element: FileElement) { }
}

export class Effect<R> {
    kind: 'Effect' = 'Effect'
    constructor(public readonly element: EffectElement<R>) { }
    public toString() {
        return this.element.callback.toString()
    }
}

export class MapHandlersStart<H1> {
    kind: 'MapHandlersStart' = 'MapHandlersStart'
    constructor(
        readonly f: <H2>(h: H1) => H2
    ) { }
}

export class MapHandlersEnd {
    kind: 'MapHandlersEnd' = 'MapHandlersEnd'
    constructor(
    ) { }
}

export function createDraftWithImages<H>(
    elements:
        (
            BasicElement<H> | PhotoGroupElement | UserMessageElement
            // | MapHandlersStart<H> | MapHandlersEnd
        )[]
): RenderDraft<H> {
    const draft = emptyDraft<H>()

    function handle(compel:
        BasicElement<H> | PhotoGroupElement | UserMessageElement
        // | MapHandlersStart<H> | MapHandlersEnd 
    ) {
        if (compel.kind === 'PhotoGroupElement') {
            mediaGroup.appendDraft(draft, compel)
        }
        else if (compel.kind === 'UserMessageElement') {
            usermessage.appendDraft(draft, compel)
        }
        // else if (compel.kind === 'MapHandlersStart') {
        //     usermessage.appendDraft(draft, compel)
        // }
        // else if (compel.kind === 'MapHandlersEnd') {
        //     usermessage.appendDraft(draft, compel)
        // }
        else {
            elementsToMessagesAndHandlers<H>(compel, draft)
        }
    }

    for (const compel of elements) {
        handle(compel)
    }

    return { ...draft }
}
