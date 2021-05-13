import * as CA from 'Lib/chatactions';
import { If, IfDef } from 'Lib/types-util';
import { TelegrafContext } from 'telegraf/typings/context';
import { createChatRendererE, getTrackingRendererE, Tracker } from '../../chatrenderer';

export const initTrackingRenderer = <R extends UseTrackingRenderer, H, E>(
    { cleanOldMessages = true } = {}
) =>
    CA.chain<R, H, E>(
        ({ chatdata, tctx }) =>
            chatdata.useTrackingRenderer
                ? CA.sequence([
                    async ctx => ({
                        ...ctx.chatdata,
                        renderer: chatdata.useTrackingRenderer!.renderer(tctx)
                    }),
                    CA.onTrue(cleanOldMessages, chatdata.useTrackingRenderer.cleanChatAction)
                ])
                : CA.doNothing
    )

export const saveToTrackerAction = <R extends UseTrackingRenderer, H, E>() =>
    CA.withChatState<R, H, E>(chatdata =>
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
// Assert extends If<Required<R>, Required<UseTrackingRenderer>, R, never> =
// If<Required<R>, Required<UseTrackingRenderer>, R, never>

export const assertType = <T>(expect: [T] extends [never] ? never : T): T => expect;

export const untrackRendererElementsAction = <R extends UseTrackingRenderer, H, E>() =>
    CA.chain<R, H, E>(
        ({ chatdata, tctx }: CA.ChatActionContext<R, H, E>): CA.AppChatAction<R, H, E> =>
            chatdata.useTrackingRenderer
                ? chatdata.useTrackingRenderer.untrackRendererElementsAction
                : CA.doNothing
    )