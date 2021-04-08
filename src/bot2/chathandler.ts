import { TelegrafContext } from "telegraf/typings/context";
import { ChatHandler, QueuedChatHandler } from "../lib/chathandler";
import { ChatHandlerFactory } from "../lib/chatsdispatcher";
import { ChatRenderer, createChatRenderer, messageTrackingRenderer } from "../lib/chatrenderer";
import { ElementsTree, TreeState } from "../lib/tree";
import { ChatUI } from "../lib/ui";
import App, { AppDispatch, storeToDispatch } from './app';
import { AwadServices, userDtoFromCtx } from "./services";
import { createAwadStore } from "./store";
import { updateUser } from "./store/user";
import { AppReqs, GetAllBasics, GetAllComps, StateReq } from "../lib/types-util";
import { elementsToMessagesAndHandlers, emptyDraft, MessagesAndHandlers, RenderDraft } from "../lib/elements-to-messages";

type AppStateRequirements = AppReqs<ReturnType<typeof App>>
type AppElements = GetAllBasics<ReturnType<typeof App>>

interface ChatF {
    handleMessage(ctx: TelegrafContext): Promise<ChatF>
    handleAction(ctx: TelegrafContext): Promise<ChatF>
    handleEvent<E>(ev: E): Promise<ChatF>
}

export type AwadContextT = {
    // state: ReturnType<ReturnType<typeof createAwadStore>['getState']>,
    dispatcher: ReturnType<typeof storeToDispatch>
}

// export const withContext = <R>(f: (ctx: WithDispatcher) => R) => {
//     return new WithContext(f)
// }

export const createChatHandlerFactory = (services: AwadServices): ChatHandlerFactory<ChatImpl<AppElements>> =>
    async ctx => {

        const renderer = messageTrackingRenderer(
            services.users,
            createChatRenderer(ctx)
        )

        const ui = new ChatUI<AppElements>()
        const store = createAwadStore(services)
        const dispatcher = storeToDispatch(store)

        const getContext = (): AwadContextT => ({
            // state: store.getState(), 
            dispatcher
        })

        let tree = new ElementsTree()

        const createDraft = (elements: AppElements[]): RenderDraft => {

            const draft = emptyDraft()

            function handle(compel: AppElements) {
                if (compel.kind == 'WithContext') {
                    handle(
                        compel.f({ dispatcher })
                    )
                }
                // else if (compel.kind == 'ButtonElement2') {
                //     // draft.inputHandlers.push()
                //     // compel.setContext({dispatcher: dispatch})
                // }
                // else if (compel.kind == 'ABCD') {

                // }
                else {
                    elementsToMessagesAndHandlers(compel, draft)
                }
            }

            for (const compel of elements) {
                handle(compel)
            }

            return draft
        }

        let renderFunc = (treeState: TreeState) => (dispatcher: AppDispatch) => {
            const [els, ns] = tree.createElements(
                App,
                { ...store.getState(), dispatcher },
                {},
                treeState
            )

            ss.renderFunc = renderFunc(ns)

            return ui.renderElementsToChat(renderer, createDraft(els))
        }

        let ss = {
            renderFunc: renderFunc({})
        }

        const onStateUpdated = () => ss.renderFunc(dispatcher)
        store.subscribe(onStateUpdated)

        const user = await services.getOrCreateUser(userDtoFromCtx(ctx))

        for (const messageId of user.renderedMessagesIds ?? []) {
            try {
                await renderer.delete(messageId)
            } catch (e) {
                console.log(`Error deleting ${messageId}`)
            }
        }

        user.renderedMessagesIds = []

        store.dispatch(updateUser(user))

        return new ChatImpl(
            ui, services, renderer, onStateUpdated
        )
    }

class ChatImpl<Els> implements ChatHandler {

    private queued: QueuedChatHandler

    constructor(
        public readonly ui: ChatUI<Els>,
        public readonly services: AwadServices,
        public readonly renderer: ChatRenderer,
        public readonly handleStateUpdated: () => Promise<void>
    ) {
        this.queued = new QueuedChatHandler({
            handleMessage: this._handleMessage,
            handleAction: this._handleAction
        })
    }

    private _handleMessage = async (ctx: TelegrafContext) => {
        if (ctx.chat?.type != 'private')
            return

        console.log(`handleMessage ${ctx.message?.text}`)

        if (ctx.message?.message_id) {
            await this.services.users.addRenderedMessage(
                ctx.chat?.id!, ctx.message?.message_id)
        }

        if (ctx.message?.text == '/start') {
            await this.ui.deleteAll(this.renderer)
            await this.handleStateUpdated()
        } else {
            if (await this.ui.handleMessage(ctx))
                this.renderer.delete(ctx.message?.message_id!)
            await this.handleStateUpdated()
        }
    }

    private _handleAction = async (ctx: TelegrafContext) => {

        if (ctx.chat?.type != 'private')
            return

        console.log(`handleAction ${ctx.match![0]}`)

        await this.ui.handleAction(ctx)
        await this.handleStateUpdated()

    }

    public handleMessage = async (ctx: TelegrafContext) => {
        return this.queued.handleMessage(ctx)
    }


    public handleAction = async (ctx: TelegrafContext) => {
        return this.queued.handleAction(ctx)
    }
}

