import { TelegrafContext } from "telegraf/typings/context";
import { parseFromContext } from './bot-util';
import { ChatRenderer } from './chatrenderer';
import { RenderDraft } from './elements-to-messages';
import { Actions } from './render-actions';
import { BotDocumentMessage, BotMessage, RenderedElement } from "./rendered-messages";
import { callHandlersChain, emptyMessage, isFalse, lastItem } from './util';

type RenderQueueElement<E> = E[]


function isEmpty<T>(items: T[]) {
    return !items.length
}

const getMessageId = (ctx: TelegrafContext) => ctx.message?.message_id

export function renderedElementsToActionHandler(renderedElements: RenderedElement[]) {
    return async (ctx: TelegrafContext) => {
        const action = ctx.match![0]
        const repliedTo = ctx.callbackQuery?.message?.message_id

        const callbackTo = renderedElements.find(
            _ => _.output.message_id == repliedTo
        )

        if (callbackTo && callbackTo.kind === 'BotMessage') {
            await callbackTo.input.callback(action)
            await ctx.answerCbQuery()
        }
        else {
            for (const el of renderedElements) {
                if (el.kind === 'BotMessage') {
                    if (await el.input.callback(action)) {
                        await ctx.answerCbQuery()
                    }
                } else {

                }
            }
        }
    }
}

export function draftToInputHandler(draft: RenderDraft, parseContext = parseFromContext) {

    return async (ctx: TelegrafContext) => {
        let deleteMessage = true

        if (!isEmpty(draft.inputHandlers)) {
            const doNotDelete = await callHandlersChain(
                draft.inputHandlers.reverse(),
                parseContext(ctx)
            )
            return !isFalse(doNotDelete)
        }

        return deleteMessage
    }
}

export async function renderActions(renderer: ChatRenderer, actions: Actions[]) {
    let rendered: RenderedElement[] = []

    const acts = actions.map(act => ({
        kind: act.kind,
        ...(
            act.kind === 'Create'
                ? { newElement: act.newElement.kind }
                : act.kind === 'Keep'
                    ? { oldElement: act.element.kind, newElement: act.newElement.kind }
                    : act.kind === 'Remove'
                        ? { oldElement: act.element.kind }
                        : { oldElement: act.element.kind, newElement: act.newElement.kind }
        )
    }))

    console.log("actions")
    console.log(
        JSON.stringify(acts, null, 2)
    );


    for (const action of actions) {
        if (action.kind === 'Create') {
            if (action.newElement.kind === 'TextMessage')
                rendered.push(
                    new BotMessage(
                        action.newElement,
                        await renderer.message(
                            action.newElement.text ?? emptyMessage,
                            action.newElement.getExtra()
                        )
                    )
                )
            else if (action.newElement.kind === 'FileMessage')
                rendered.push(
                    new BotDocumentMessage(
                        action.newElement,
                        action.newElement.element.isPhoto
                            ? await renderer.sendPhoto(action.newElement.element.file)
                            : await renderer.sendFile(action.newElement.element.file)
                    )
                )
        }
        else if (action.kind === 'Keep') {
            if (action.newElement.kind === 'TextMessage')
                rendered.push(new BotMessage(
                    action.newElement, action.element.output
                ))
            else if (action.newElement.kind == 'FileMessage')
                rendered.push(action.element)
            // rendered.push(new BotDocumentMessage(
            //     action.newElement, action.element.
            // ))
        }
        else if (action.kind === 'Remove') {
            renderer.delete(action.element.output.message_id)
        }
        else if (action.kind === 'Replace') {
            if (action.newElement.kind === 'TextMessage')
                rendered.push(
                    new BotMessage(
                        action.newElement,
                        await renderer.message(
                            action.newElement.text ?? emptyMessage,
                            action.newElement.getExtra(),
                            action.element.output,
                            false
                        )
                    )
                )
            // else if (action.newElement.kind === 'FileMessage' && action.element.kind == 'BotDocumentMessage')
            //     rendered.push(
            //         new BotDocumentMessage(
            //             action.newElement,
            //             action.element.output
            //         )
            //     )
        }
    }

    return rendered
}

export class ChatUI {

    constructor(
    ) { }

    private isRendering = false
    private renderQueue: Actions[][] = []

    async renderUiActions
        (
            renderer: ChatRenderer,
            actions: Actions[]
        ): Promise<RenderedElement[] | undefined> {
        let renderedElements: RenderedElement[] = []

        if (this.isRendering) {
            console.log("this.isRendering == TRUE");

            this.renderQueue.push(actions)
            return
        }

        this.isRendering = true

        renderedElements = await renderActions(renderer, actions)

        console.log('Rendering Finished')

        this.isRendering = false

        const moreRender = lastItem(this.renderQueue)

        if (moreRender) {
            this.renderQueue = []
            return await this.renderUiActions(renderer, moreRender)
        }
        return renderedElements
    }

    async deleteAll(renderer: ChatRenderer, renderedElements: RenderedElement[]) {
        await this.clear(renderer, renderedElements)
    }

    async clear(renderer: ChatRenderer, messages: RenderedElement[]) {
        for (const el of messages) {
            try {
                await renderer.delete(el.output.message_id)
            } catch (e) {
                console.error(e);
                continue
            }
        }
    }
}

export async function deleteAll(renderer: ChatRenderer, messages: RenderedElement[]) {
    for (const el of messages) {
        try {
            await renderer.delete(el.output.message_id)
        } catch (e) {
            console.error(e);
            continue
        }
    }
}