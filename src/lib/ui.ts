import { TelegrafContext } from "telegraf/typings/context";
import { parseFromContext } from './bot-util';
import { elementsToMessagesAndHandlers } from './elements-to-messages';
import { ActionsHandler, InputHandler } from "./messages";
import { BotDocumentMessage, BotMessage, RenderedElement, UserMessage } from "./rendered-messages";
import { ChatRenderer } from './chatrender';
import { Actions, createRenderActions } from './render-actions';
import { BasicElement } from "./elements";
import { callHandlersChain, emptyMessage, isFalse, lastItem } from './util';

type RenderQueueElement = BasicElement[]


function isEmpty<T>(items: T[]) {
    return !items.length
}

const getMessageId = (ctx: TelegrafContext) => ctx.message?.message_id

export class ChatUI {

    constructor(
        readonly renderer: ChatRenderer
    ) { }

    private isRendering = false
    private renderedElements: RenderedElement[] = []
    private renderQueue: RenderQueueElement[] = []

    // private inputHandler?: InputHandler
    // private actionHandler?: ActionsHandler
    private inputHandlers: InputHandler[] = []

    private parseContext = parseFromContext
    private createUiActions = createRenderActions
    private createMessagesFromElements = elementsToMessagesAndHandlers

    async handleMessage(ctx: TelegrafContext) {
        let deleteMessage = true

        if (!isEmpty(this.inputHandlers)) {
            const doNotDelete = await callHandlersChain(
                this.inputHandlers.reverse(),
                this.parseContext(ctx)
            )
            deleteMessage = !isFalse(doNotDelete)
        }

        if (deleteMessage && ctx.message?.message_id)
            await this.renderer.delete(ctx.message?.message_id)
        else if (ctx.message)
            this.renderedElements.push(new UserMessage(ctx.message))
    }

    async handleAction(ctx: TelegrafContext) {
        const action = ctx.match![0]
        const repliedTo = ctx.callbackQuery?.message?.message_id

        const callbackTo = this.renderedElements.find(
            _ => _.output.message_id == repliedTo
        )

        if (callbackTo && callbackTo.kind === 'BotMessage') {
            await callbackTo.input.callback(action)
            await ctx.answerCbQuery()
        }
        else {
            for (const el of this.renderedElements) {
                if (el.kind === 'BotMessage') {
                    if (await el.input.callback(action)) {
                        await ctx.answerCbQuery()
                    }
                } else {

                }
            }
        }
    }

    async renderActions(actions: Actions[]) {
        let rendered: RenderedElement[] = []

        for (const action of actions) {
            if (action.kind === 'Create') {
                if (action.newElement.kind === 'TextMessage')
                    rendered.push(
                        new BotMessage(
                            action.newElement,
                            await this.renderer.message(
                                action.newElement.text ?? emptyMessage,
                                action.newElement.getExtra()
                            )
                        )
                    )
                else if (action.newElement.kind === 'FileElement')
                    rendered.push(
                        new BotDocumentMessage(
                            action.newElement,
                            await this.renderer.sendFile(action.newElement.file)
                        )
                    )
            }
            else if (action.kind === 'Keep') {
                if (action.newElement.kind === 'TextMessage')
                    rendered.push(new BotMessage(
                        action.newElement, action.element.output
                    ))
                // else if (action.newElement instanceof FileElement)
                //     rendered.push(new BotDocumentMessage(
                //         action.newElement, action.element.message
                //     ))
            }
            else if (action.kind === 'Remove') {
                this.renderer.delete(action.element.output.message_id)
            }
            else if (action.kind === 'Replace') {
                if (action.newElement.kind === 'TextMessage')
                    rendered.push(
                        new BotMessage(
                            action.newElement,
                            await this.renderer.message(
                                action.newElement.text ?? emptyMessage,
                                action.newElement.getExtra(),
                                action.element.output,
                                false
                            )
                        )
                    )
            }
        }

        return rendered
    }

    async renderElementsToChat(elements: BasicElement[]): Promise<void> {
        // this.inputHandler = undefined
        // this.actionHandler = undefined
        this.inputHandlers = []

        // let rendered: RenderedElement[] = []

        if (this.isRendering) {
            this.renderQueue.push(elements)
            return
        }

        const {
            messages, handlers, effects, keyboards, inputHandlers
        } = this.createMessagesFromElements(elements)

        this.inputHandlers = inputHandlers

        if (!messages.length)
            console.error(`Empty messages!`)

        console.log('Rendering Started')

        const actions = this.createUiActions(this.renderedElements, messages)

        this.isRendering = true

        this.renderedElements = await this.renderActions(actions)

        console.log('Rendering Finished')

        for (const effect of effects) {
            await effect.callback()
        }

        this.isRendering = false

        const moreRender = lastItem(this.renderQueue)

        if (moreRender) {
            this.renderQueue = []
            await this.renderElementsToChat(moreRender)
        }
    }

    async deleteAll() {
        await this.clear()
        this.renderedElements = []
    }

    async clear(messages?: RenderedElement[]) {
        if (!messages)
            messages = this.renderedElements

        for (const el of messages) {
            try {
                await this.renderer.delete(el.output.message_id)
            } catch (e) {
                console.error(e);
                continue
            }
        }
    }
}
