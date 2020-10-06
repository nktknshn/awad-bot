import deq from 'fast-deep-equal';
import { TelegrafContext } from "telegraf/typings/context";
import { componentToMessagesAndHandlers, filterTextMessages } from './component';
import { ActionsHandler, BotDocumentMessage, BotMessage, Effect, Element, InputHandler, RenderedElement, TextMessage, UserMessage } from "./elements";
import { Renderer } from './render';
import { ComponentGenerator, FileElement, InputHandlerData } from "./types";
import { parseFromContext } from './bot-util'
import { emptyMessage, enumerate, lastItem, pairs } from './util';

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

        console.log(`this.renderedElements`);
        for (const el of this.renderedElements) {
            if (el instanceof BotMessage) {
                console.log(`BotMessage(${el.textMessage.text})`);
            } else {
                console.log(`${el.constructor.name}`);
            }
        }

        for (const el of this.renderedElements) {
            if (el instanceof BotMessage) {
                console.log(`Checking BotMessage(${el.textMessage.text})`);
                if (await el.textMessage.callback(action)) {
                    console.log(`Callbacked`);
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

            console.log('Rendering Started')

            // if (keyboards.length) {
            //     const textMessages =
            //         filterTextMessages(messages)
            //             .filter(m => m.buttons.length == 0)

            //     textMessages[0].addKeyboardButton(
            //         lastItem(keyboards)!
            //     )
            // }

            for (const el of [...messages, ...handlers, ...effects]) {
                const els = await this.processElement(el)
                rendered = [...rendered, ...els]
            }

            await this.clear(this.renderedElements)
            this.renderedElements = rendered

            console.log('Rendering Finished')

            this.isRendering = false

            const lastRender = lastItem(this.renderQueue)
            
            if (lastRender) {
                this.renderQueue = []
                await this.renderGenerator(lastRender)
            }
        }
    }

    async processElement(element: Element) {
        let rendered: RenderedElement[] = []

        console.log(`processElement ${element.constructor.name}`)

        if (element instanceof TextMessage) {
            let updatable = this.renderedElements.shift()

            // if(updatable instanceof UserMessage)
            //     updatable = this.renderedElements.shift()
            // while (updatable instanceof UserMessage) {
            //     rendered.push(updatable)
            //     updatable = this.renderedElements.shift()
            // }

            if (updatable && updatable instanceof BotMessage) {

                if (updatable.textMessage.text == element.text
                    && deq(
                        updatable.textMessage.getExtra(),
                        element.getExtra())
                ) {
                    rendered.push(new BotMessage(
                        element, updatable.message
                    ))
                } else {
                    // console.log(updatable.textMessage.keyboardButtons);
                    // console.log(updatable.textMessage.keyboardButtons.length > 0);

                    rendered.push(
                        new BotMessage(
                            element,
                            await this.renderer.message(
                                element.text ?? emptyMessage,
                                element.getExtra(),
                                updatable.message,
                                false
                            )
                        )
                    )
                }
            }
            else {
                if (updatable && updatable instanceof BotDocumentMessage)
                    await this.renderer.delete(updatable.message.message_id)

                rendered.push(
                    new BotMessage(
                        element,
                        await this.renderer.message(
                            element.text ?? emptyMessage,
                            element.getExtra()
                        )
                    )
                )
            }
        }
        else if (element instanceof FileElement) {
            rendered.push(
                new BotDocumentMessage(
                    element,
                    await this.renderer.file(element.file)
                )
            )
        }
        else if (element instanceof InputHandler) {
            this.inputHandler = element
            this.inputHandlers.push(element)
        }
        else if (element instanceof ActionsHandler) {
            this.actionHandler = element
        }
        else if (element instanceof Effect) {
            await element.callback()
        }

        return rendered

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
