import { pipe } from "fp-ts/lib/function";
import * as CA from 'Lib/chatactions';
import { ComponentElement } from "Lib/component";
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import { UseTrackingRenderer } from "Lib/components/actions/tracker";
import * as AP from 'Lib/newapp';
import { OnUndefined, WithComponent, WithInit, WithReducer } from "Lib/newapp";
import { ChatActionReducer, ChatStateAction, chatstateAction, reducer, storeReducer, storeReducer2 } from 'Lib/reducer';
import { StoreF2 } from 'Lib/storeF';
import { ApplicationUtil, BasicAppEvent, GetAllComps, GetStateDeps, RenderFunc, StateReq, Utils } from 'Lib/types-util';
import { application, ChatState } from "./application";
import { LocalStateAction } from "./tree2";

interface ReloadOnStart {
    reloadOnStart: boolean
    bufferActions: boolean
}

export type DefaultState =
    & FL.FlushState
    & FL.FlushAction
    & TR.UseTrackingRenderer
    // & Record<K, StoreF2<unknown, unknown>>
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

const zeroReducer = <R, H>() => reducer<never, CA.AppChatAction<R, H>>((_): _ is never => false, _ => CA.doNothing)

export const withStore = <
    R extends DefaultState & Record<K, StoreF2<unknown, unknown>>, H, Ext, RootComp extends ComponentElement, P, T, H1,
     K extends keyof R>(a: Utils<R, H, BasicAppEvent<R, H>,
        WithComponent<P, RootComp>
        & AP.WithState<T>
        & WithReducer<H1, R, H> & Ext,
        RootComp>, {
            storeKey,
            storeAction = apply => a.actions([apply, CA.render])
        }: {
            storeKey: K,
            storeAction?: (apply: CA.AppChatAction<R, H>) => CA.AppChatAction<R, H>
        }) =>
    pipe(a
        , a => a.extendF(AP.attachStore(storeKey))
        , AP.addReducer(_ => storeReducer2(storeKey, storeAction))
    )

export const myDefaultBehaviour = <R extends DefaultState, H, Ext, RootComp extends ComponentElement, P, T>(a: Utils<R, H, BasicAppEvent<R, H>, WithComponent<P, RootComp> & AP.WithState<T> & Ext, RootComp>,
    {
        render = a.action(CA.render),
        renderMessage = a.action(render),
        renderAction = a.actions([render, CA.replyCallback]),
        reloadInterfaceAction = reloadInterface,
        flushAction = a.action(CA.chatState(s => s.flushAction())),
        flushIfNeeded = a.action(FL.flushIfNeeded(flushAction)),
        applyEffects = CA.applyEffects,
        useTracking = true,
    } = {}
) => pipe(a
    , AP.defaultBuild
    , AP.addReducer(_ => FL.flushReducer(flushAction))
    , AP.extend(a => ({
        chatActions: ({
            render, renderMessage, renderAction, reloadInterfaceAction, flushAction,
            flushIfNeeded, applyEffects
        })
    }))
    , AP.extend(a => ({
        defaultMessageHandler: a.actions([
            CA.applyInputHandler,
            TR.saveToTrackerAction(),
            // FL.addUserMessageIfNeeded(),
            CA.addRenderedUserMessage(),
            applyEffects,
            FL.deferredRender(a.actions([
                renderMessage,
                flushIfNeeded
            ]))
        ])
        , handleAction: a.actions([
            CA.applyActionHandler,
            applyEffects,
            CA.chain(({ chatdata }) => chatdata.bufferActions
                ? FL.deferredRender(a.actions([
                    renderAction,
                    flushIfNeeded
                ]))
                : a.actions([
                    renderAction,
                    flushIfNeeded
                ])),
            // flushIfNeeded,
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
        ]),
    }))
    , AP.extend(_ => ({
        init: _.ext.defaultInit
    }))
    , AP.props({})
)

