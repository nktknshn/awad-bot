import * as CA from 'Lib/chatactions';
import { TelegrafContext } from 'telegraf/typings/context';
import { createChatRendererE, getTrackingRendererE, Tracker } from '../../chatrenderer';

export const initTrackingRenderer = <R extends UseTrackingRenderer, H, E>(
    { cleanPrevious = true } = {}
) =>
    CA.chain<R, H, E>(
        ({ chatdata, tctx }) =>
            chatdata.useTrackingRenderer
                ? CA.sequence([
                    async ctx => ({
                        ...ctx.chatdata,
                        renderer: chatdata.useTrackingRenderer!.renderer(tctx)
                    }),
                    CA.onTrue(cleanPrevious, chatdata.useTrackingRenderer.cleanChatAction)
                ])
                : CA.doNothing
    )

export const saveToTrackerAction = <R extends UseTrackingRenderer, H, E>() =>
    CA.chatState<R, H, E>(chatdata =>
        chatdata.useTrackingRenderer
            ? chatdata.useTrackingRenderer.saveToTrackerAction
            : CA.doNothing
    )

export interface UseTrackingRenderer {
    useTrackingRenderer?: ReturnType<typeof getTrackingRendererE>
}

export const createDefaultRenderer =
    async (tctx: TelegrafContext) => ({ renderer: createChatRendererE(tctx) })

export const withTrackingRenderer = (t?: Tracker) => async () => ({
    useTrackingRenderer: t ? getTrackingRendererE(t) : undefined
})

export const untrackRendererElementsAction = <R extends UseTrackingRenderer, H, E>() =>
    CA.chain<R, H, E>(
        ({ chatdata, tctx }) =>
            chatdata.useTrackingRenderer
                ? chatdata.useTrackingRenderer.untrackRendererElementsAction
                : CA.doNothing
    )