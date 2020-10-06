import { componentToMessagesAndHandlers } from "./component";
import { ActionsHandler, BotMessage, Effect, InputHandler, RenderedElement, TextMessage } from "./elements";
import { ComponentGenerator, FileElement } from "./types";

export async function renderGenerator(
    component: ComponentGenerator,
    renderedElements: RenderedElement[] = []
) {
    renderedElements = [...renderedElements]

    const {
        messages, handlers,
        effects, keyboards } = componentToMessagesAndHandlers(component)

    for (const el of [...messages, ...handlers, ...effects]) {
        if (el instanceof TextMessage) {

            let updatable = renderedElements.shift()
            if (updatable && updatable instanceof BotMessage) {
            }
        }
        else if (el instanceof FileElement) {

        }
        else if (el instanceof InputHandler) {

        }
        else if (el instanceof ActionsHandler) {

        }
        else if (el instanceof Effect) {

        }
    }
}