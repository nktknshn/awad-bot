import { TelegrafContext } from "telegraf/typings/context"
import { areSame, parseFromContext } from "./bot-util"
import { componentToMessagesAndHandlers } from "./component"
import { RenderedElement, ActionsHandler, BotMessage, TextMessage, InputHandler } from "./elements"
import { Renderer } from "./render"
import { ComponentGenerator } from "./types"
import { zip } from "./util"

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
        readonly renderer: Renderer,
        readonly handler: LinearUIHandler
    ) { }


    spawnedComponent?: SpawnedComponent

    despawnComponent = async () => {
        if (!this.spawnedComponent)
            return

        for (const el of this.spawnedComponent.elements) {
            if (el instanceof BotMessage) {
                await this.renderer.delete(el.message.message_id)
            }
        }

        delete this.spawnedComponent
    }

    async spawnComponent(
        component: ComponentGenerator,
        target?: SpawnedComponent
    ) {
        const { messages, handlers, effects } =
            componentToMessagesAndHandlers(component)

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
                    && areSame(spawnedEl.textMessage, el)
                ) {
                    spawnedComponent.elements.push(spawnedEl)
                    continue
                }

                const message = await this.renderer.message(
                    el.text ? el.text : '<empty>',
                    el.getExtra(),
                    spawnedEl?.message
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
                    if (await h.callback(parsed) !== false) {
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
                if (await el.textMessage.callback(action)) {
                    await ctx.answerCbQuery()
                }
            }
        }
    }
}
