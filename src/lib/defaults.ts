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
    & FL.FlushAction
    & TR.UseTrackingRenderer
    & Record<K, StoreF2<unknown, unknown>>
    & ReloadOnStart

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
// opts: {
//     renderMessage: CA.AppChatAction<R, H>,
//     renderAction: CA.AppChatAction<R, H>,
//     reloadInterfaceAction: CA.AppChatAction<R, H>,
//     flushIfNeeded: CA.AppChatAction<R, H>,
//     useTracking: boolean,
//     storeKey: K
// } = {
//         renderMessage: CA.render,
//         renderAction: CA.sequence([CA.render, CA.replyCallback]),
//         reloadInterfaceAction: reloadInterface(),
//         flushIfNeeded: FL.flushIfNeeded(CA.chatState(s => s.flushAction())),
//         useTracking: true,
//         storeKey: 'store' as K
//     }
export const myDefaultBehaviour = <R extends DefaultState<K>, H, Ext, RootComp extends ComponentElement, P, T, K extends keyof any = 'store',>(a: Utils<R, H, BasicAppEvent<R, H>, WithComponent<P, RootComp> & AP.WithState<T> & Ext, RootComp>,
    {
        render = CA.render,
        renderMessage = a.action(render),
        renderAction = a.actions([render, CA.replyCallback]),
        reloadInterfaceAction = reloadInterface,
        flushAction = a.action(CA.chatState(s => s.flushAction())),
        flushIfNeeded = a.action(FL.flushIfNeeded(flushAction)),
        useTracking = true,
        storeKey = 'store' as K
    } = {}
) => pipe(a
    , AP.defaultBuild
    , a => a.extendF(AP.attachStore(storeKey))
    , AP.addReducer(_ => FL.flushReducer(flushAction))
    , AP.addReducer(_ => storeReducer(storeKey))
    , AP.extend(a => ({
        defaultMessageHandler: a.actions([
            CA.applyInputHandler,
            TR.saveToTrackerAction(),
            // FL.addUserMessageIfNeeded(),
            CA.addRenderedUserMessage(),
            CA.applyEffects,
            FL.deferredRender(renderMessage)
        ])
        , handleAction: a.actions([
            CA.applyActionHandler,
            CA.applyEffects,
            CA.chain(({ chatdata }) => chatdata.bufferActions
                ? FL.deferredRender(renderAction)
                : renderAction),
            flushIfNeeded,
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
)

