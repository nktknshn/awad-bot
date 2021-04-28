import { TelegrafContext } from "telegraf/typings/context";
import { mediaGroup, RenderedMediaGroup } from "../bot3/mediagroup";
import { parseFromContext } from './bot-util';
import { ChatRenderer } from './chatrenderer';
import { RenderDraft } from './elements-to-messages';
import { mylog } from "./logging";
import { Actions } from './render-actions';
import { BotDocumentMessage, BotMessage, RenderedElement } from "./rendered-messages";
import { usermessage } from "./usermessage";
import { callHandlersChain, emptyMessage, isFalse, lastItem } from './util';

type RenderQueueElement<E> = E[]


function isEmpty<T>(items: T[]) {
    return !items.length
}

const getMessageId = (ctx: TelegrafContext) => ctx.message?.message_id

const isBotMessage = (a: RenderedElement): a is BotMessage => a.kind === 'BotMessage'

export function renderedElementsToActionHandler(renderedElements: RenderedElement[]) {
    return async (ctx: TelegrafContext) => {
        const action = ctx.match![0]
        const repliedTo = ctx.callbackQuery?.message?.message_id

        const callbackTo = renderedElements.filter(isBotMessage).find(
            _ =>
                Array.isArray(_.output)
                    ? _.output.map(_ => _.message_id).find((_ => _ == repliedTo))
                    : _.output.message_id == repliedTo
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

export function draftToInputHandler<H>(draft: RenderDraft<H>, parseContext = parseFromContext) {

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

export async function removeRenderedElements(renderer: ChatRenderer, action: Actions.Remove) {
    if (action.element.kind === 'RenderedPhotoGroup')
        await mediaGroup.actions.remove(action.element)(renderer)
    else if (action.element.kind === 'RenderedUserMessage')
        await usermessage.actions.remove(action.element)(renderer)
    else
        await renderer.delete(action.element.output.message_id)
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

    mylog("actions")
    mylog(
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
            else if (action.newElement.kind === 'OutcomingPhotoGroupMessage')
                rendered.push(
                    await mediaGroup.actions.create(action.newElement)(renderer)
                )
            else if (action.newElement.kind === 'OutcomingUserMessage')
                rendered.push(
                    await usermessage.actions.create(action.newElement)(renderer)
                )
        }
        else if (action.kind === 'Keep') {
            if (action.newElement.kind === 'TextMessage' && (
                action.element.kind === 'BotMessage'
            )) {
                // UPDATE HANDLERS!
                rendered.push(new BotMessage(
                    action.newElement,
                    action.element.output
                ))
            }
            else if (action.newElement.kind === 'OutcomingPhotoGroupMessage' && (
                action.element.kind === 'RenderedPhotoGroup'
            )) {
                rendered.push(new RenderedMediaGroup(
                    action.newElement,
                    action.element.output
                ))
            }
            else {
                rendered.push(action.element)
            }
        }
        else if (action.kind === 'Remove') {
            await removeRenderedElements(renderer, action)
            // if (action.element.kind === 'RenderedPhotoGroup')
            //     await mediaGroup.actions.remove(action.element)(renderer)
            // else if (action.element.kind === 'RenderedUserMessage')
            //     await usermessage.actions.remove(action.element)(renderer)
            // else
            //     await renderer.delete(action.element.output.message_id)
        }
        else if (action.kind === 'Replace') {
            if (action.newElement.kind === 'TextMessage' && action.element.kind === 'BotMessage')
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

export async function deleteAll(renderer: ChatRenderer, messages: RenderedElement[]) {
    for (const el of messages) {
        try {
            if (Array.isArray(el.output))
                for (const m of el.output)
                    await renderer.delete(m.message_id)
            else
                if (el.kind === 'BotMessage')
                    await renderer.delete(el.output.message_id)
                else if (el.kind === 'RenderedUserMessage')
                    await renderer.delete(el.output)
        } catch (e) {
            console.error(e);
            continue
        }
    }
}