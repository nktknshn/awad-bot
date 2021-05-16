import chalk from "chalk";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/pipeable";
import * as TE from "fp-ts/lib/TaskEither";
import { OutcomingFileMessage } from "Lib/draft";
import { OutcomingTextMessage } from "Lib/textmessage";
import { TelegrafContext } from "telegraf/typings/context";
import { mediaGroup, RenderedMediaGroup } from "../bot3/mediagroup";
import { parseFromContext } from './bot-util';
import { ChatRenderer, ChatRendererError } from './chatrenderer';
import { RenderDraft } from './elements-to-messages';
import { mylog } from "./logging";
import { RenderActions } from './render-actions';
import { BotDocumentMessage, BotMessage, RenderedElement } from "./rendered-messages";
import { usermessage } from "./usermessage";
import { callHandlersChain, emptyMessage, isFalse } from './util';


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

export async function removeRenderedElements(renderer: ChatRenderer, action: RenderActions.Remove) {
    if (action.element.kind === 'RenderedPhotoGroup')
        await mediaGroup.actions.remove(action.element)(renderer)
    else if (action.element.kind === 'RenderedUserMessage')
        await usermessage.actions.remove(action.element)(renderer)
    else
        await renderer.delete(action.element.output.message_id)()
}


const appendElement = (el: RenderedElement) => (rs: RenderedElement[]) => [...rs, el]

const CreateTextMessage =
    (action: RenderActions.Create) => (renderer: ChatRenderer)
        : TE.TaskEither<ChatRendererError, (rs: RenderedElement[]) => RenderedElement[]> => {
        if (action.newElement.kind === 'TextMessage') {
            return pipe(
                renderer.message(
                    action.newElement.text ?? emptyMessage,
                    action.newElement.getExtra()
                ),
                TE.map(el => new BotMessage(
                    action.newElement as OutcomingTextMessage<any>,
                    el)
                ),
                TE.map(appendElement)
            )
        }
        else if (action.newElement.kind === 'FileMessage') {
            return action.newElement.element.isPhoto
                ? pipe(
                    renderer.sendPhoto(action.newElement.element.file)
                    , TE.map(el => new BotDocumentMessage(action.newElement as OutcomingFileMessage, el))
                    , TE.map(appendElement)
                )
                : pipe(
                    renderer.sendFile(action.newElement.element.file)
                    , TE.map(el => new BotDocumentMessage(action.newElement as OutcomingFileMessage, el))
                    , TE.map(appendElement)
                )
        }
        else if (action.newElement.kind === 'OutcomingPhotoGroupMessage')
            return pipe(mediaGroup.actions.create(action.newElement)(renderer), TE.map(appendElement))
        else if (action.newElement.kind === 'OutcomingUserMessage')
            return pipe(
                usermessage.actions.create(action.newElement)(renderer),
                TE.map(appendElement)
            )

        return TE.of(rs => rs)
    }

export async function renderActions(
    renderer: ChatRenderer,
    actions: RenderActions[])
    : Promise<E.Either<ChatRendererError, RenderedElement[]>> {

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

    const kinds = acts.map(_ => _.kind)
    const updated = kinds.map(_ => _ == 'Keep').includes(false)
    const color = updated ? chalk.yellow : chalk.green

    // mylog(color("renderActions"))
    mylog(
        color(`${JSON.stringify(kinds)}`)
    );
    

    const actionsOther = actions.filter(_ => _.kind !== 'Remove')
    const actionsRemove = actions.filter(_ => _.kind === 'Remove')

    for (const action of [...actionsOther, ...actionsRemove]) {
        // await new Promise(resolve => setTimeout(() => resolve(0), 300))

        if (action.kind === 'Create') {
            const ret = await CreateTextMessage(action)(renderer)()

            if (E.isRight(ret)) {
                rendered = ret.right(rendered)
            }
            else {
                return E.left(ret.left)
            }
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
        }
        else if (action.kind === 'Replace') {
            if (action.newElement.kind === 'TextMessage'
                && action.element.kind === 'BotMessage') {

                const ret = await pipe(
                    renderer.message(
                        action.newElement.text ?? emptyMessage,
                        action.newElement.getExtra(),
                        action.element.output,
                        false
                    ),
                    TE.map(el => new BotMessage(action.newElement as OutcomingTextMessage<any>, el))
                )()

                if (E.isRight(ret)) {
                    rendered.push(ret.right)
                }
                else {
                    return E.left(ret.left)
                }
            }
        }
    }

    return E.right(rendered)
}

export async function deleteAll(renderer: ChatRenderer, messages: RenderedElement[]) {
    for (const el of messages) {
        try {
            if (Array.isArray(el.output))
                for (const m of el.output)
                    await renderer.delete(m.message_id)()
            else
                if (el.kind === 'BotMessage')
                    await renderer.delete(el.output.message_id)()
                else if (el.kind === 'RenderedUserMessage')
                    await renderer.delete(el.output)()
        } catch (e) {
            continue
        }
    }
}