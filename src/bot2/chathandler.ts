import { flow } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import * as R from "fp-ts/lib/Reader";
import * as T from "fp-ts/lib/Task";

import { TelegrafContext } from "telegraf/typings/context";
import { Application, ChatHandler, ChatHandler2, QueuedChatHandler, genericRenderFunction } from "../lib/chathandler";
import { ChatRenderer, createChatRenderer, messageTrackingRenderer } from "../lib/chatrenderer";
import { ChatHandlerFactory } from "../lib/chatsdispatcher";
import { BasicElement, ComponentElement, InputHandlerElement } from "../lib/elements";
import { elementsToMessagesAndHandlers, emptyDraft, RenderDraft } from "../lib/elements-to-messages";
import { createRenderActions } from "../lib/render-actions";
import { RenderedElement } from "../lib/rendered-messages";
import { ElementsTree, TreeState } from "../lib/tree";
import { AppReqs, GetAllBasics } from "../lib/types-util";
import { ChatUI, deleteAll, draftToInputHandler, renderActions, renderedElementsToActionHandler } from "../lib/ui";
import App from './app';
import WordsPage from "./components/WordsPage";
import { AwadServices, userDtoFromCtx } from "./services";
import { createAwadStore, RootState } from "./store";
import { updateUser, UserEntityState } from "./store/user";
import { storeToDispatch } from "./storeToDispatch";

import * as O from 'fp-ts/lib/Option'
import { Do } from 'fp-ts-contrib/lib/Do'
import { option } from "commander";

type AppStateRequirements = AppReqs<ReturnType<typeof App>>
type AppElements = GetAllBasics<ReturnType<typeof App>> | InputHandlerElement

export type AwadContextT = {
    // state: RootState,
    dispatcher: ReturnType<typeof storeToDispatch>
} & RootState

const createDraft = (getContext: () => AwadContextT) => (elements: AppElements[]): RenderDraft => {

    const draft = emptyDraft()

    function handle(compel: AppElements) {
        if (compel.kind == 'WithContext') {
            handle(compel.f(getContext()))
        }
        else {
            elementsToMessagesAndHandlers(compel, draft)
        }
    }

    for (const compel of elements) {
        handle(compel)
    }

    return draft
}

async function clearOldMessages(user: UserEntityState, renderer: ChatRenderer) {
    for (const messageId of user.renderedMessagesIds ?? []) {
        try {
            await renderer.delete(messageId)
        } catch (e) {
            console.log(`Error deleting ${messageId}`)
        }
    }

    user.renderedMessagesIds = []
}

const contextOpt = flow(
    (ctx: TelegrafContext) => ({
        chatId: O.fromNullable(ctx.chat?.id),
        messageId: O.fromNullable(ctx.message?.message_id),
        messageText: O.fromNullable(ctx.message?.text)
    }))

type ContextOpt = ReturnType<typeof contextOpt>

const saveMessageTask =
    flow(
        R.ask<{ services: AwadServices }>(),
        ({ services }) => flow((c: ContextOpt) => Do(O.option)
            .sequenceS(c)
            .return(({ chatId, messageId }) =>
                services.users.addRenderedMessage(chatId, messageId)),
            O.getOrElse(async () => { })
        )
    )


export function createAwadApplication(services: AwadServices): Application {

    const store = createAwadStore(services)

    const getContext = () => ({
        ...store.getState(),
        dispatcher: storeToDispatch(store)
    })

    const saveMessage = saveMessageTask({ services })

    return {
        renderFunc: genericRenderFunction(App, getContext, createDraft(getContext), {}),
        renderer: ctx => messageTrackingRenderer(
            services.users,
            createChatRenderer(ctx)
        ),
        init: async (ctx, renderer, chat) => {
            const user = await services.getOrCreateUser(userDtoFromCtx(ctx))

            await clearOldMessages(user, renderer)

            store.subscribe(() => chat.handleEvent(ctx, "updated"))
            store.dispatch(updateUser(user))
        },
        handleMessage: async (ctx, renderer, chat, chatdata) => {

            await saveMessage(contextOpt(ctx))
            await pipe(
                Do(O.option)
                    .sequenceS(contextOpt(ctx))
                    .return(async ({ chatId, messageId, messageText }) => {
                        if (messageText == '/start') {
                            await deleteAll(renderer, chatdata.renderedElements)
                            await chat.handleEvent(ctx, "updated", { ...chatdata, renderedElements: [] })
                        }
                        else {
                            if (await chatdata.inputHandler(ctx))
                                renderer.delete(messageId)

                            await chat.handleEvent(ctx, "updated")
                        }
                    }),
                O.getOrElse(async () => { })
            )

        }
    }
}
