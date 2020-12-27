import { QueuedChat } from "../lib/chat";
import { ChatFactory } from "../lib/chatshandler";
import { createRenderer, messageTrackingRenderer } from "../lib/render";
import { UI } from "../lib/ui";
import { dtoFromCtx, Services } from "./services";
import { createStore, RootState } from "./store";
import { updateUser } from "./store/user";
import { App, AppProps, MappedApp, stateToProps } from './app'
import { Component, ComponentWithState, ConnectedComp } from "../lib/types";
import { assignStateTree, componentToTree, copyPropsTree, copyStateTree, extractStateTree, getRenderFromTree, printStateTree, printTree, printZippedTree, PropsTree, renderTree, StateTree, Tree, zipTreeWithStateTree } from "../lib/tree";
import { equal, ObjectHelper } from "../lib/util3dparty";

export const createChatCreator = (services: Services): ChatFactory =>
    async ctx => {

        const renderer = messageTrackingRenderer(
            services.users,
            createRenderer(ctx)
        )

        const ui = new UI(renderer)

        const root = ConnectedComp(MappedApp,
            ({ path, user }: RootState) => ({
                path,
                userLoaded: !!user
            }))

        const store = createStore(services)

        let state: {
            tree?: Tree,
            prevStateTree?: StateTree,
            nextStateTree?: StateTree,
            lastProps?: PropsTree
        } = {}

        const renderFunc = async (props: AppProps) => {
            console.log(`renderFunc`)

            const stateTreeIsSame = state.tree
                && equal(state.prevStateTree, state.nextStateTree)

            const propsAreSame = state.tree
                && equal(
                    copyPropsTree(componentToTree(root(props),
                        state.nextStateTree,
                        store.getState())
                    ),
                    state.lastProps
                )

            if (stateTreeIsSame && propsAreSame) {
                console.log(`Props and state are same`);
                await ui.renderGenerator(getRenderFromTree(state.tree!))
                return
            }

            if (state.prevStateTree && state.nextStateTree && state.tree) {

                console.log('Something changed')
                console.log('state.prevStateTree');
                printStateTree(state.prevStateTree)

                console.log()
                console.log('state.nextStateTree');
                printStateTree(state.nextStateTree)

                console.log()
                console.log('state.tree');
                printTree(state.tree)

                const prevTree = assignStateTree(state.tree, state.prevStateTree)

                console.log()
                console.log('prevTree');

                printTree(prevTree)

                const zipped = zipTreeWithStateTree(prevTree, state.nextStateTree)


                console.log()
                console.log('zipped');
                printZippedTree(zipped)

                console.log('renderTree');
                state.tree = renderTree(zipped, root(props), store.getState())

                console.log()
                console.log('state.tree');
                printTree(state.tree)
                // const elements = getRenderFromTree(newTree)
                // await ui.renderGenerator(elements)
            }
            else {
                console.log('First draw!')
                state.tree = componentToTree(root(props), undefined, store.getState())
                // printTree(state.tree)
            }

            state.lastProps = copyPropsTree(state.tree)
            state.prevStateTree = copyStateTree(state.tree)
            state.nextStateTree = extractStateTree(state.tree)

            const elements = getRenderFromTree(state.tree)

            // console.log('elements');
            // console.log(elements);

            await ui.renderGenerator(elements)
        }

        let user = await services.getUser(ctx.chat?.id!)

        if (!user) {
            user = await services.createUser(dtoFromCtx(ctx))
        }

        const update = () => renderFunc(stateToProps(store, ui, services))

        if (user.renderedMessagesIds && user.renderedMessagesIds.length) {
            for (const messageId of user.renderedMessagesIds) {
                try {
                    await renderer.delete(messageId)
                } catch (e) {
                    console.log(`Error deleting ${messageId}`)
                }
            }
            user.renderedMessagesIds = []
        }

        store.subscribe(update)
        store.dispatch(updateUser(user))

        return new QueuedChat({
            async handleMessage(ctx) {

                if (ctx.chat?.type != 'private')
                    return

                console.log(`handleMessage ${ctx.message?.text}`)

                if (ctx.message?.message_id) {
                    await services.users.addRenderedMessage(
                        ctx.chat?.id!, ctx.message?.message_id)
                }

                if (ctx.message?.text == '/start') {
                    await ui.deleteAll()
                    await update()
                    // if (state.onUpdated)
                    //     await state.onUpdated(state)
                    await renderer.delete(ctx.message.message_id)
                } else {
                    await ui.handleMessage(ctx)
                }

                await update()
            },
            async handleAction(ctx) {

                if (ctx.chat?.type != 'private')
                    return

                console.log(`handleAction ${ctx.match![0]}`)
                await ui.handleAction(ctx)
                await update()

            },
        })
    }