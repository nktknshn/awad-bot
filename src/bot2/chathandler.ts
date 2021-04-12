import { TelegrafContext } from "telegraf/typings/context";
import { ChatHandler, QueuedChatHandler } from "../lib/chathandler";
import { createChatRenderer, messageTrackingRenderer } from "../lib/chatrenderer";
import { ChatHandlerFactory } from "../lib/chatsdispatcher";
import { ComponentElement, InputHandlerElement } from "../lib/elements";
import { elementsToMessagesAndHandlers, emptyDraft, RenderDraft } from "../lib/elements-to-messages";
import { createRenderActions } from "../lib/render-actions";
import { RenderedElement } from "../lib/rendered-messages";
import { ElementsTree, TreeState } from "../lib/tree";
import { AppReqs, GetAllBasics } from "../lib/types-util";
import { ChatUI, draftToInputHandler, renderedElementsToActionHandler } from "../lib/ui";
import App from './app';
import WordsPage from "./components/WordsPage";
import { AwadServices, userDtoFromCtx } from "./services";
import { createAwadStore, RootState } from "./store";
import { updateUser } from "./store/user";
import { storeToDispatch } from "./storeToDispatch";

type AppStateRequirements = AppReqs<ReturnType<typeof App>>
type AppElements = GetAllBasics<ReturnType<typeof App>> | InputHandlerElement
// type AppElements = BasicElement | WithContext<any, BasicElement> 
const w = WordsPage({})
type Z = typeof w extends ComponentElement ? true : false

interface ChatF {
    handleMessage(ctx: TelegrafContext): Promise<ChatF>
    handleAction(ctx: TelegrafContext): Promise<ChatF>
    handleEvent<E>(ev: E): Promise<ChatF>
}

export type AwadContextT = {
    // state: RootState,
    dispatcher: ReturnType<typeof storeToDispatch>
} & RootState

// export const withContext = <R>(f: (ctx: WithDispatcher) => R) => {
//     return new WithContext(f)
// }

interface ChatState {
    treeState: TreeState,
    renderedElements: RenderedElement[],
    inputHandler: (ctx: TelegrafContext) => Promise<void | boolean>,
    actionHandler: (ctx: TelegrafContext) => Promise<void>,
}

export const createChatHandlerFactory = (services: AwadServices): ChatHandlerFactory<ChatHandler> =>
    async ctx => {

        const renderer = messageTrackingRenderer(
            services.users,
            createChatRenderer(ctx)
        )

        const ui = new ChatUI()
        const store = createAwadStore(services)
        const dispatcher = storeToDispatch(store)
        let tree = new ElementsTree()

        const getContext = (): AwadContextT => ({
            ...store.getState(),
            dispatcher
        })

        const createDraft = (elements: AppElements[]): RenderDraft => {

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

        let renderFunc = (ss: ChatState) => async (gc = getContext): Promise<ChatState> => {
            const [els, ns] = tree.createElements(App, gc(), {}, ss.treeState)

            const draft = createDraft(els)
            const inputHandler = draftToInputHandler(draft)
            const actions = createRenderActions(ss.renderedElements, draft.messages)

            for (const effect of draft.effects) {
                await effect.element.callback()
            }

            const renderedElements = await ui.renderUiActions(renderer, actions)

            if (!renderedElements)
                return ss

            const actionHandler = renderedElementsToActionHandler(renderedElements)

            return {
                treeState: ns,
                inputHandler,
                actionHandler,
                renderedElements
            }
        }

        let ss: ChatState = {
            treeState: {},
            renderedElements: [],
            inputHandler: async function () { },
            actionHandler: async function () { },
        }

        const onStateUpdated = (src: string) => async () => {
            console.log(`onStateUpdated by ${src}`);
            const newChatState = await renderFunc(ss)(getContext)
            for (const k in ss) {
                (ss as any)[k] = (newChatState as any)[k]
            }
        }

        const user = await services.getOrCreateUser(userDtoFromCtx(ctx))

        for (const messageId of user.renderedMessagesIds ?? []) {
            try {
                await renderer.delete(messageId)
            } catch (e) {
                console.log(`Error deleting ${messageId}`)
            }
        }

        user.renderedMessagesIds = []

        const handleEvent = async (ctx: TelegrafContext, data: string) => {
            if (data == 'updated') {
                await onStateUpdated("handleEvent")()
            }
        }

        const chat = new QueuedChatHandler({
            handleAction: async (ctx) => {
                await ss.actionHandler(ctx)
                await handleEvent(ctx, "updated")
            },
            handleMessage: async (ctx) => {
                if (ctx.message?.message_id) {
                    await services.users.addRenderedMessage(
                        ctx.chat?.id!, ctx.message?.message_id)
                }

                if (ctx.message?.text == '/start') {
                    await ui.deleteAll(renderer, ss.renderedElements)
                    ss.renderedElements = []
                    await handleEvent(ctx, "updated")
                } else {
                    if (await ss.inputHandler(ctx))
                        renderer.delete(ctx.message?.message_id!)
                        await handleEvent(ctx, "updated")
                }
            },
            handleEvent
        })

        store.subscribe(() => chat.handleEvent(ctx, "updated"))
        store.dispatch(updateUser(user))

        return chat
    }

// class ChatImpl<Els> implements ChatHandler {

//     private queued: QueuedChatHandler

//     constructor(
//         public readonly ui: ChatUI<Els>,
//         public readonly services: AwadServices,
//         public readonly renderer: ChatRenderer,
//         public readonly handleStateUpdated: () => Promise<void>
//     ) {
//         this.queued = new QueuedChatHandler({
//             handleMessage: this._handleMessage,
//             handleAction: this._handleAction
//         })
//     }

//     private _handleMessage = async (ctx: TelegrafContext) => {
//         if (ctx.chat?.type != 'private')
//             return

//         console.log(`handleMessage ${ctx.message?.text}`)

//         if (ctx.message?.message_id) {
//             await this.services.users.addRenderedMessage(
//                 ctx.chat?.id!, ctx.message?.message_id)
//         }

//         if (ctx.message?.text == '/start') {
//             // await this.ui.deleteAll(this.renderer)
//             await this.handleStateUpdated()
//         } else {
//             // if (await this.ui.handleMessage(ctx))
//                 this.renderer.delete(ctx.message?.message_id!)
//             await this.handleStateUpdated()
//         }
//     }

//     private _handleAction = async (ctx: TelegrafContext) => {

//         if (ctx.chat?.type != 'private')
//             return

//         console.log(`handleAction ${ctx.match![0]}`)

//         // await this.ui.handleAction(ctx)
//         await this.handleStateUpdated()

//     }

//     public handleMessage = async (ctx: TelegrafContext) => {
//         return this.queued.handleMessage(ctx)
//     }


//     public handleAction = async (ctx: TelegrafContext) => {
//         return this.queued.handleAction(ctx)
//     }
// }

