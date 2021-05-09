import * as A from 'fp-ts/lib/Array';
import { Eq } from "fp-ts/lib/Eq";
import { pipe } from 'fp-ts/lib/pipeable';
import { InputFile, Message } from "telegraf/typings/telegram-types";
import { ChatRenderer } from '../lib/chatrenderer';
import { OutcomingMessageType, RenderDraft } from "../lib/elements-to-messages";
import * as TE from "fp-ts/lib/TaskEither";


export function photos(fs: InputFile[]) {
    return new PhotoGroupElement(fs)
}

export class PhotoGroupElement {
    kind: 'PhotoGroupElement' = 'PhotoGroupElement'
    constructor(
        readonly files: InputFile[]
    ) { }
}

export class OutcomingPhotoGroupMessage {
    kind: 'OutcomingPhotoGroupMessage' = 'OutcomingPhotoGroupMessage'
    constructor(public readonly element: PhotoGroupElement) {
    }
}

export class RenderedMediaGroup {
    kind: 'RenderedPhotoGroup' = 'RenderedPhotoGroup';
    canReplace = (other: OutcomingMessageType) => false
    constructor(
        readonly input: OutcomingPhotoGroupMessage,
        readonly output: Array<Message>
    ) { }

    outputIds = () => this.output.map(_ => _.message_id)
}

const eqInputFile: Eq<InputFile> = {
    equals: (a: InputFile, b: InputFile) => {
        return a.toString() == b.toString()
    }
}

export function areSameMediaGroup(a: RenderedMediaGroup, b: OutcomingPhotoGroupMessage) {
    return A.getEq(eqInputFile).equals(a.input.element.files, b.element.files)
}

function create(
    newElement: OutcomingPhotoGroupMessage,
) {
    return function (renderer: ChatRenderer) {
       return pipe(
            renderer.sendMediaGroup(newElement.element.files),
            TE.map(el => new RenderedMediaGroup(newElement, el))
        )
    }
}

function remove(
    el: RenderedMediaGroup,
) {
    return async function (renderer: ChatRenderer) {
        for (const m of el.output)
            await renderer.delete(m.message_id)()
    }
}

export const mediaGroup = {
    element: PhotoGroupElement,
    outcoming: OutcomingPhotoGroupMessage,
    rendered: RenderedMediaGroup,
    equals: areSameMediaGroup,
    actions: {
        create,
        remove
    },
    appendDraft: <H>(draft: RenderDraft<H>, el: PhotoGroupElement) => {
        draft.messages.push(
            new OutcomingPhotoGroupMessage(el)
        )
    }
}
