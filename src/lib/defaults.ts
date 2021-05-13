import { pipe } from "fp-ts/lib/function";
import * as CA from 'Lib/chatactions';
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import * as AP from 'Lib/newapp';
import { WithComponent, WithReducer } from "Lib/newapp";
import { chatStateAction, reducer, storeReducer } from 'Lib/reducer';
import { StoreF2 } from 'Lib/storeF';
import { AppBuilder } from "Lib/appbuilder";

interface ReloadOnStart {
    reloadOnStart: boolean
    bufferActions: boolean
}

export type DefaultState =
    & FL.FlushState
    & FL.FlushAction
    & TR.UseTrackingRenderer
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
    chatStateAction<{ reloadOnStart: boolean }>(s =>
        ({ ...s, reloadOnStart })
    )
export const setbufferActions = (bufferActions: boolean) =>
    chatStateAction<{ bufferActions: boolean }>(s =>
        ({ ...s, bufferActions })
    )

export const defaultFlushAction = <R extends TR.UseTrackingRenderer & FL.FlushState, H, E>() =>
    CA.sequence<R, H, E>([
        TR.untrackRendererElementsAction(),
        CA.flush
    ])

const zeroReducer = <R, H>() => reducer<never, CA.AppChatAction<R, H>>((_): _ is never => false, _ => CA.doNothing)

type WithStoreArgs<R, H, K extends keyof R> = {
    storeKey: K,
    storeAction?: (apply: CA.AppChatAction<R, H>) => CA.AppChatAction<R, H>
}

export const withStore = <
    R extends DefaultState & Record<K, StoreF2<unknown, unknown>>, H, Ext, RootComp, H1,
    K extends keyof R>(a: AppBuilder<R, H,
        & WithReducer<H1, R, H> & Ext, RootComp>, {
            storeKey,
            storeAction = apply => a.actions([apply, CA.render])
        }: WithStoreArgs<R, H, K>): AppBuilder<R, H,
            Ext & Record<`attachStore_${string & K}`, CA.AppChatAction<R, H>>
            & WithReducer<H1 | Parameters<R[K]["applyAction"]>[0], R, H>
            , RootComp> =>
    pipe(a
        , a => a.extendF(AP.attachStore(storeKey))
        , AP.addReducer(_ => storeReducer(storeKey, storeAction))
    )

type DefaultRenderActions<R extends DefaultState, H> = {
    render: CA.AppChatAction<R, H>,
    renderMessage: CA.AppChatAction<R, H>,
    renderAction: CA.AppChatAction<R, H>,
    reloadInterfaceAction: () => CA.AppChatAction<R, H>,
    flushAction: CA.AppChatAction<R, H>,
    flushIfNeeded: CA.AppChatAction<R, H>,
    applyEffects: CA.AppChatAction<R, H>,
}
// , AP.extend(a => ({
//     chatActions: defaults({
//         render: a.action(CA.render),
//         renderMessage: a.action(render),
//         renderAction: a.actions([render, CA.replyCallback]),
//         reloadInterfaceAction: reloadInterface,
//         flushAction: a.action(CA.withChatState(s => s.flushAction())),
//         flushIfNeeded: a.action(FL.flushIfNeeded(flushAction)),
//         applyEffects: CA.applyEffects,
//         // useTracking: true,
//     })
// }))

function getdef<R extends DefaultState, H, Ext, RootComp, P, T>
    (a: AppBuilder<R, H, WithComponent<P, RootComp> & AP.WithState<T> & Ext, RootComp>) {
    class DefaultRender {
        render = a.action(CA.render)
        renderMessage = a.action(this.render)
        renderAction = a.actions([this.render, CA.replyCallback])
        reloadInterfaceAction = reloadInterface
        flushAction = a.action(CA.withChatState(s => s.flushAction()))
        flushIfNeeded = a.action(FL.flushIfNeeded(this.flushAction))
        applyEffects = CA.applyEffects
    }

    return new DefaultRender()
}


export const addDefaultBehaviour = <R extends DefaultState, H, Ext, RootComp, P, T>(a: AppBuilder<R, H, WithComponent<P, RootComp> & AP.WithState<T> & Ext, RootComp>,
    {
        render = a.action(CA.render),
        renderMessage = a.action(render),
        renderAction = a.actions([render, CA.replyCallback]),
        reloadInterfaceAction = reloadInterface,
        flushAction = a.action(CA.withChatState(s => s.flushAction())),
        flushIfNeeded = a.action(FL.flushIfNeeded(flushAction)),
        applyEffects = CA.applyEffects,
        useTracking = true,
    } = {}
    // defaults: (d: DefaultRenderActions<R, H>) => DefaultRenderActions<R, H>
    // defaults = getdef(a)
) => pipe(a
    , AP.defaultBuild
    , AP.addReducer(_ => FL.flushReducer(flushAction))
    , AP.extend(a => ({
        chatActions: ({
            render, renderMessage, renderAction, reloadInterfaceAction,
            flushAction, flushIfNeeded, applyEffects
        })
        , defaultMessageHandler: a.actions([
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
        ])
    }))
    , AP.extend(a => ({
        handleMessage: a.action(CA.chain(
            ({ tctx, chatdata }) =>
                chatdata.reloadOnStart && CA.ifStart(tctx)
                    ? a.actionF(reloadInterfaceAction)
                    : a.ext.defaultMessageHandler))

        , defaultInit: ({ cleanOldMessages = true } = {}) => a.actions([
            CA.onTrue(useTracking, TR.initTrackingRenderer({ cleanOldMessages })),
        ])
    }))
    , AP.extend(_ => ({
        init: _.ext.defaultInit
    }))
    , AP.props({})
)

