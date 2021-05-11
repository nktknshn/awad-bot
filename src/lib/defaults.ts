import { pipe } from "fp-ts/lib/function";
import * as CA from 'Lib/chatactions';
import { ComponentElement } from "Lib/component";
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import { UseTrackingRenderer } from "Lib/components/actions/tracker";
import * as AP from 'Lib/newapp';
import { WithComponent } from "Lib/newapp";
import { ChatActionReducer, ChatStateAction, chatstateAction, storeReducer } from 'Lib/reducer';
import { StoreF2 } from 'Lib/storeF';
import { ApplicationUtil, BasicAppEvent, GetAllComps, GetStateDeps, RenderFunc, StateReq, Utils } from 'Lib/types-util';
import { application, ChatState } from "./application";
import { LocalStateAction } from "./tree2";

interface ReloadOnStart {
    reloadOnStart: boolean
    bufferActions: boolean
}

export type DefaultState<K extends keyof any> =
    & FL.FlushState
    & TR.UseTrackingRenderer
    & Record<K, StoreF2<unknown, unknown>>
    & ReloadOnStart
    & FL.FlushAction

export const withDefaults = ({
    reloadOnStart = true,
    deferRender = 1500,
    bufferedInputEnabled = false,
    bufferedOnce = false,
    doFlush = false,
    bufferActions = false,
    flushAction = defaultFlushAction
} = {}) =>
    async () =>
    ({
        reloadOnStart, bufferActions,
        ...(await FL.withFlush({
            doFlush, deferRender, bufferedInputEnabled, bufferedOnce
        })()),
        flushAction
    })


// type Ut<R, H, P, RootComp, Ext> = Utils<R, H, BasicAppEvent<R, H>,
//     WithComponent<P, RootComp> & Ext, RootComp>

export const setReloadOnStart = (reloadOnStart: boolean) =>
    chatstateAction<{ reloadOnStart: boolean }>(s =>
        ({ ...s, reloadOnStart })
    )
export const setbufferActions = (bufferActions: boolean) =>
    chatstateAction<{ bufferActions: boolean }>(s =>
        ({ ...s, bufferActions })
    )

export const defaultFlushAction = <R extends TR.UseTrackingRenderer & FL.FlushState, H, E>() =>
    CA.sequence<R, H, E>([
        TR.untrackRendererElementsAction(),
        CA.flush
    ])

export const myDefaultBehaviour = <K extends keyof any = 'store'>(
    {
        useTracking = true,
        reloadInterfaceAction = reloadInterface
    } = {}, storeKey: K = 'store' as K
) => <
    R extends DefaultState<K>,
    H, Ext, RootComp extends ComponentElement, P
>(u: Utils<R, H, BasicAppEvent<R, H>,
    WithComponent<P, RootComp> & Ext, RootComp>) => pipe(u
        , AP.defaultBuild
        // , a => withStore ? a.extendF(AP.attachStore(storeKey)) : a
        , a => a.extendF(AP.attachStore(storeKey))
        , AP.addReducer(_ => FL.flushReducer(
            CA.chatState(s => s.flushAction())
        ))
        , AP.addReducer(_ => storeReducer(storeKey))
        , AP.extend(a => ({
            defaultMessageHandler: a.actions([
                CA.applyInputHandler,
                TR.saveToTrackerAction(),
                FL.addUserMessageIfNeeded(),
                CA.applyEffects,
                FL.deferredRender()
            ])
            , handleAction: a.actions([
                CA.applyActionHandler,
                CA.applyEffects,
                CA.chain(({ chatdata }) => chatdata.bufferActions
                    ? FL.deferredRender({
                        renderAction: () => CA.sequence([CA.render, CA.replyCallback])
                    })
                    : a.actions([CA.render, CA.replyCallback])),
                FL.flushIfNeeded(CA.chatState(s => s.flushAction())),
            ])
        }))
        , AP.extend(a => ({
            handleMessage: a.action(CA.chain(
                ({ tctx, chatdata }) =>
                    chatdata.reloadOnStart && CA.ifStart(tctx)
                        ? a.actionF(reloadInterfaceAction)
                        : a.ext.defaultMessageHandler))
        }))
        , AP.extend(_ => ({
            defaultInit: ({ cleanOldMessages = true } = {}) => _.actions([
                CA.onTrue(useTracking, TR.initTrackingRenderer({ cleanOldMessages })),
                _.ext.attachStore
            ])
        }))
        , AP.props({})
        // , AP.extend(_ => ({

        // )
    )

