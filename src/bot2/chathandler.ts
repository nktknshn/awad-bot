import { flow } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import * as R from "fp-ts/lib/Reader";
import * as T from "fp-ts/lib/Task";

import { TelegrafContext } from "telegraf/typings/context";
import { Application, ChatHandler, ChatHandler2, QueuedChatHandler, genericRenderFunction, ChatState, emptyChatState, ChatS } from "../lib/chathandler";
import { ChatRenderer, createChatRenderer, messageTrackingRenderer } from "../lib/chatrenderer";
import { ChatHandlerFactory } from "../lib/chatsdispatcher";
import { BasicElement, ComponentElement, InputHandlerElement } from "../lib/elements";
import { defaultCreateDraft, elementsToMessagesAndHandlers, emptyDraft, RenderDraft } from "../lib/elements-to-messages";
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
import { UserRepository } from "../database/entity/user";

type AppStateRequirements = AppReqs<ReturnType<typeof App>>
type AppElements = GetAllBasics<ReturnType<typeof App>> | InputHandlerElement

export type AwadContextT = {
    // state: RootState,
    dispatcher: ReturnType<typeof storeToDispatch>
} & RootState

const createDraft = (getContext: () => AwadContextT) => (elements: AppElements[]): RenderDraft => {

    const draft = emptyDraft()

    // function handle(compel: AppElements) {
    //     if (compel.kind == 'WithContext') {
    //         handle(compel.f(getContext()))
    //     }
    //     else {
    //         elementsToMessagesAndHandlers(compel, draft)
    //     }
    // }

    for (const compel of elements) {
        // handle(compel)
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

async function deleteTem(
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState>,
    chatdata: ChatState,
) {
    await deleteAll(renderer, chatdata.renderedElements)
    await chat.handleEvent(ctx, "updated",
        chatdata => ({ ...chatdata, renderedElements: [] })
    )
}

function saveMessageHandler(services: AwadServices) {
    return function (
        c: ContextOpt
    ) {

        return Do(O.option)
            .sequenceS(c)
            .return(({ chatId, messageId }) =>
                (ctx: TelegrafContext,
                    renderer: ChatRenderer,
                    chat: ChatHandler2<ChatState>,
                    chatdata: ChatState) => services.users.addRenderedMessage(chatId, messageId)
            )

    }
}

function startHandler(c: ContextOpt) {
    return pipe(
        c.messageText,
        O.filter(m => m == '/start'),
        O.map(() => deleteTem)
    )
}


function defaultHandler(c: ContextOpt) {
    return pipe(
        Do(O.option)
            .sequenceS(c)
            .return(({ chatId, messageId, messageText }) => {
                return defaultH(messageId)
            }),
    )
}


const defaultH = (messageId: number) => {
    return async function def(
        ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<ChatState>,
        chatdata: ChatState,
    ) {
        if (await chatdata.inputHandler(ctx))
            await renderer.delete(messageId)

        await chat.handleEvent(ctx, "updated")
    }
}

type FuncF = (
    ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState>,
    chatdata: ChatState
) => Promise<any>

function renderer(t: UserRepository) {
    return function (ctx: TelegrafContext) {
        return messageTrackingRenderer(
            t,
            createChatRenderer(ctx)
        )
    }
}

import * as A from 'fp-ts/lib/Array'

const handlerChain = (chain: O.Option<FuncF>[]) => {
    return (ctx: TelegrafContext,
        renderer: ChatRenderer,
        chat: ChatHandler2<ChatState>,
        chatdata: ChatState) =>
        Promise.all(pipe(
            chain,
            A.map(
                O.map(z => z(ctx, renderer, chat, chatdata))
            ),
            A.filter(O.isSome),
            A.map(a => T.of(a.value))
        ))
}
const or = (a: O.Option<FuncF>, b: O.Option<FuncF>) => pipe(a, O.alt(() => b))

const parseContextOpt = <R>(f: (ctxOpt: ContextOpt) => FuncF): FuncF => {

        return async function(ctx: TelegrafContext,
            renderer: ChatRenderer,
            chat: ChatHandler2<ChatState>,
            chatdata: ChatState) {
                return f(contextOpt(ctx))(ctx, renderer, chat, chatdata)

        }
    }

async function defaultHandleAction(ctx: TelegrafContext,
    renderer: ChatRenderer,
    chat: ChatHandler2<ChatState>,
    chatdata: ChatState) {
        await chatdata.actionHandler(ctx)
        await chat.handleEvent(ctx, "updated")
}

export function createAwadApplication(services: AwadServices): Application<ChatState> {

    const store = createAwadStore(services)

    const getContext = () => ({
        ...store.getState(),
        dispatcher: storeToDispatch(store)
    })

    const saveMessage = saveMessageHandler(services)

    return {
        chatData: emptyChatState,
        renderFunc: genericRenderFunction(App, getContext, {}),
        renderer: renderer(services.users),
        init: async (ctx, renderer, chat, chatdata) => {
            const user = await services.getOrCreateUser(userDtoFromCtx(ctx))

            await clearOldMessages(user, renderer)

            store.subscribe(() => chat.handleEvent(ctx, "updated"))
            store.dispatch(updateUser(user))
        },
        handleMessage: parseContextOpt(ctxOpt => handlerChain([
            saveMessage(ctxOpt),
            or(startHandler(ctxOpt), defaultHandler(ctxOpt))
        ])),
        handleAction: defaultHandleAction
    }
}
