import * as CA from 'Lib/chatactions';
import { TelegrafContext } from 'telegraf/typings/context';
import { createChatRendererE, getTrackingRendererE, Tracker } from '../../chatrenderer';

export const initTrackingRenderer = <R extends UseTrackingRenderer, H, E>() =>
    CA.chain<R, H, E>(
        ({ chatdata, tctx }) =>
            chatdata.useTrackingRenderer
                ? CA.sequence([
                    async ctx => ({
                        ...ctx.chatdata,
                        renderer: chatdata.useTrackingRenderer!.renderer(tctx)
                    }),
                    chatdata.useTrackingRenderer.cleanChatAction
                ])
                : CA.sequence([
                ])
    )

export const saveToTrackerAction = <R extends UseTrackingRenderer, H, E>() => CA.chatState<R, H, E>(chatdata =>
    chatdata.useTrackingRenderer
        ? chatdata.useTrackingRenderer.saveToTrackerAction
        : CA.doNothing
)


export interface UseTrackingRenderer {
    useTrackingRenderer?: ReturnType<typeof getTrackingRendererE>
}

export const createDefaultRenderer =
    async (tctx: TelegrafContext) => ({ renderer: createChatRendererE(tctx) })

export const useTrackingRenderer = (t: Tracker) => async () => ({
    useTrackingRenderer: getTrackingRendererE(t)
})
