import { TelegrafContext } from "telegraf/typings/context"
import { areSameTextMessages, parseFromContext } from "./bot-util"
import { elementsToMessagesAndHandlers } from "./elements-to-messages"
import { ActionsHandler, TextMessage, InputHandler } from "./messages"
import { RenderedElement, BotMessage } from "./rendered-messages"
import { ChatRenderer } from "./chatrender"
import { ComponentGenerator, BasicElement } from "./elements"
import { emptyMessage, zip } from "./util"

type SpawnedComponent = {
    elements: RenderedElement[],
    handlers: (InputHandler | ActionsHandler)[]
}


export interface LinearUIHandler {
    handleMessage(ui: LinearUI, ctx: TelegrafContext): Promise<void | false>
    // handleAction(ui: LinearUI, ctx: TelegrafContext): Promise<void>
}

export class LinearUI {
    constructor(
        readonly renderer: ChatRenderer,
        readonly handler: LinearUIHandler
    ) { }


    spawnedComponent?: SpawnedComponent

    despawnComponent = async () => {
        if (!this.spawnedComponent)
            return

        for (const el of this.spawnedComponent.elements) {
            if (el instanceof BotMessage) {
                await this.renderer.delete(el.output.message_id)
            }
        }

        delete this.spawnedComponent
    }

    async spawnComponent(
        elements: BasicElement[],
        target?: SpawnedComponent
    ) {
        const { messages, handlers, effects } =
            elementsToMessagesAndHandlers(elements)

        const spawnedComponent: SpawnedComponent = {
            elements: [],
            handlers
        }

        for (const [el, spawnedEl] of zip(
            messages.filter(_ => _ instanceof TextMessage),
            (target?.elements ?? []).filter(_ => _ instanceof BotMessage))
        ) {
            if (el instanceof TextMessage) {

                if (spawnedEl instanceof BotMessage
                    && areSameTextMessages(spawnedEl.input, el)
                ) {
                    spawnedComponent.elements.push(spawnedEl)
                    continue
                }

                const message = await this.renderer.message(
                    el.text ? el.text : emptyMessage,
                    el.getExtra(),
                    spawnedEl?.output
                )

                spawnedComponent.elements.push(
                    new BotMessage(el, message)
                )
            }
        }

        return spawnedComponent
    }

    async handleMessage(ctx: TelegrafContext) {
        if (await this.handler.handleMessage(this, ctx) !== false) {
            if (!this.spawnedComponent)
                return

            const parsed = parseFromContext(ctx)

            for (const h of this.spawnedComponent.handlers.reverse()) {
                if (h instanceof InputHandler) {
                    if (await h.callback(parsed, async () => {}) !== false) {
                        await this.renderer.delete(ctx.message?.message_id!)
                    }
                    break
                }
            }
        }
    }

    async handleAction(ctx: TelegrafContext) {
        if (!this.spawnedComponent)
            return

        const action = ctx.match![0]

        for (const el of this.spawnedComponent.elements) {
            if (el instanceof BotMessage) {
                if (await el.input.callback(action)) {
                    await ctx.answerCbQuery()
                }
            }
        }
    }
}
