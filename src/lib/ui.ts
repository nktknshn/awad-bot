import deq from 'fast-deep-equal';
import { TelegrafContext } from "telegraf/typings/context";
import { componentToMessagesAndHandlers, filterTextMessages } from './component';
import { ActionsHandler, BotDocumentMessage, BotMessage, Effect, Element, InputHandler, RenderedElement, TextMessage, UserMessage } from "./elements";
import { Renderer } from './render';
import { ComponentGenerator, FileElement, InputHandlerData } from "./types";
import { parseFromContext } from './bot-util'
import { emptyMessage, enumerate, lastItem, pairs } from './util';
import { Actions, getTask } from './rendertask';

const isFalse = (v: any): v is false => typeof v === 'boolean' && v == false
const isTrue = (v: any): v is true => typeof v === 'boolean' && v == true

export class UI {

    constructor(
        readonly renderer: Renderer
    ) { }

    renderedElements: RenderedElement[] = []
    inputHandler?: InputHandler
    actionHandler?: ActionsHandler

    contextParser = parseFromContext

    isRendering = false

    renderQueue: ComponentGenerator[] = []

    inputHandlers: InputHandler[] = []

    getHandler() {

    }

    async handleMessage(ctx: TelegrafContext) {
        let deleteMessage = true

        async function callHandler(idx: number, inputHandlers: InputHandler[], data: InputHandlerData): Promise<void | boolean> {
            return inputHandlers[idx].callback(
                data,
                () => callHandler(idx + 1, inputHandlers, data)
            )
        }

        if (this.inputHandlers.length) {
            // for (const [idx, handler] of enumerate(this.inputHandlers).reverse()) {
            //     if (!handler)
            //         break
            const handlers = this.inputHandlers.reverse()
            const ret = await callHandler(0, handlers, this.contextParser(ctx),)

            deleteMessage = !isFalse(ret)

            // if (!isFalse(ret)) {
            //     break
            // }
        }

        // if (this.inputHandler) {
        //     const ret = await this.inputHandler.callback(
        //         this.contextParser(ctx)
        //     )

        //     deleteMessage = !isFalse(ret)
        // }

        if (deleteMessage && ctx.message?.message_id)
            await this.renderer.delete(ctx.message?.message_id)
        else if (ctx.message)
            this.renderedElements.push(new UserMessage(ctx.message))
    }

    async handleAction(ctx: TelegrafContext) {
        const action = ctx.match![0]
        const repliedTo = ctx.callbackQuery?.message?.message_id

        // if (this.actionHandler) {
        //     await this.actionHandler.callback(action)
        //     await ctx.answerCbQuery()
        //     return
        // }

        const callbackTo = this.renderedElements.find(
            _ => _.message.message_id == repliedTo
        )

        // console.log(`this.renderedElements`);
        for (const el of this.renderedElements) {
            if (el instanceof BotMessage) {
                // console.log(`BotMessage(${el.textMessage.text})`);
            } else {
                // console.log(`${el.constructor.name}`);
            }
        }

        for (const el of this.renderedElements) {
            if (el instanceof BotMessage) {
                // console.log(`Checking BotMessage(${el.textMessage.text})`);
                if (await el.textMessage.callback(action)) {
                    // console.log(`Callbacked`);
                    await ctx.answerCbQuery()
                }
            }
        }

        if (callbackTo && callbackTo instanceof BotMessage) {
            // callbackTo.textMessage.callback(action)
            // await ctx.answerCbQuery()

        }
        // else if (repliedTo) {
        //     try {
        //         await this.renderer.delete(repliedTo)
        //     } catch (e) {
        //         console.error(`Message ${repliedTo} doesn't exist`)
        //     }
        // }
    }

    async renderGenerator(component: ComponentGenerator) {
        this.inputHandler = undefined
        this.actionHandler = undefined
        this.inputHandlers = []

        let rendered: RenderedElement[] = []

        if (this.isRendering) {
            this.renderQueue.push(component)
        } else {
            this.isRendering = true

            const { messages, handlers, effects, keyboards } = componentToMessagesAndHandlers(component)

            if (!messages.length)
                console.error(`Empty messages!`)

            console.log(`effects: ${effects}`);

           
            console.log('Rendering Started')

            // if (keyboards.length) {
            //     const textMessages =
            //         filterTextMessages(messages)
            //             .filter(m => m.buttons.length == 0)

            //     textMessages[0].addKeyboardButton(
            //         lastItem(keyboards)!
            //     )
            // }


            const actions = getTask(this.renderedElements, messages)

            for (const action of actions) {
                console.log(`action: ${action.constructor.name}`);
            }

            for (const action of actions) {

                if (action instanceof Actions.Create) {
                    if (action.newElement instanceof TextMessage)
                        rendered.push(
                            new BotMessage(
                                action.newElement,
                                await this.renderer.message(
                                    action.newElement.text ?? emptyMessage,
                                    action.newElement.getExtra()
                                )
                            )
                        )
                    else if (action.newElement instanceof FileElement)
                        rendered.push(
                            new BotDocumentMessage(
                                action.newElement,
                                await this.renderer.file(action.newElement.file)
                            )
                        )
                }
                else if (action instanceof Actions.Leave) {
                    if (action.newElement instanceof TextMessage)
                        rendered.push(new BotMessage(
                            action.newElement, action.element.message
                        ))
                    // else if (action.newElement instanceof FileElement)
                    //     rendered.push(new BotDocumentMessage(
                    //         action.newElement, action.element.message
                    //     ))
                }
                else if (action instanceof Actions.Remove) {
                    this.renderer.delete(action.element.message.message_id)
                }
                else if (action instanceof Actions.Replace) {
                    if (action.newElement instanceof TextMessage)
                        rendered.push(
                            new BotMessage(
                                action.newElement,
                                await this.renderer.message(
                                    action.newElement.text ?? emptyMessage,
                                    action.newElement.getExtra(),
                                    action.element.message,
                                    false
                                )
                            )
                        )
                }
            }

            for (const handler of handlers) {
                if (handler instanceof InputHandler)
                    this.inputHandlers.push(handler)
            }

            this.renderedElements = rendered

            console.log('Rendering Finished')

            for (const effect of effects) {
                await effect.callback()
            }

            this.isRendering = false

            const lastRender = lastItem(this.renderQueue)

            if (lastRender) {
                this.renderQueue = []
                await this.renderGenerator(lastRender)
            }
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
                await this.renderer.delete(el.message.message_id)
            } catch (e) {
                console.error(e);
                continue
            }
        }
    }
}
