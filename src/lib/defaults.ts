import { identity, pipe } from "fp-ts/lib/function";
import * as CA from 'Lib/chatactions';
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import * as AP from 'Lib/newapp';
import { WithComponent } from "Lib/newapp";
import { ChatActionReducer, chatStateAction, defaultReducer, reducer } from 'Lib/reducer';
import { AppBuilder } from "Lib/appbuilder";
import { AppActionsFlatten, BasicAppEvent, ComponentReqs, GetState, If, StateConstructor } from "./types-util";
import { ChatState } from "./chatstate";
import { AppDef3, build3, ReplaceExt } from "./appbuilder3";
import { ComponentElement } from "./component";
import { DE } from "./lib";

interface ReloadOnStart {
    reloadOnStart: boolean
    bufferActions: boolean
}

export type DefaultState =
    & FL.FlushState
    & FL.FlushAction
    & TR.UseTrackingRenderer
    & ReloadOnStart

export const defaultState = ({
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

export type AnyFunction<A = any> = (...input: any[]) => A
export type AnyConstructor<A = object> = new (...input: any[]) => A

export type Mixin<T extends AnyFunction> = InstanceType<ReturnType<T>>


export const addDefaultBehaviour2 = <R extends DefaultState, H, Ext, ReqContext, P, T, StateDeps = unknown>
    (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<R, StateDeps> & Ext, ReqContext>) => {
    // return (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>) =>
    //     addDefaultBehaviour(a, f(a)())
    return [a, getDefaultActions(a)] as const
}

export const modifyActions = <R extends DefaultState, H, Ext, ReqContext, P, T, StateDeps>
    (a: AB<R, H, P, ReqContext, T, Ext, StateDeps>) => {

    const actions = getDefaultActions(a)()

    return {
        a,
        modify: (f: (arg: typeof actions) => Partial<typeof actions>) =>
            addHandlers(a, getDefaultActions(a)(f(actions)))
    }

}


export const getDefaultActions = <R extends DefaultState, H, Ext, ReqContext, P, T, StateDeps = unknown>
    (a: AB<R, H, P, ReqContext, T, Ext, StateDeps>) => (
        {
            render = a.action(CA.render),
            applyEffects = CA.applyEffects,
            applyInputHandler = a.action(CA.applyInputHandler),
            applyActionHandler = a.action(CA.applyActionHandler),
            replyCallback = CA.replyCallback,
            deferredRender = FL.deferredRender,

            flushAction = a.action(CA.withChatState(s => s.flushAction())),
            flushIfNeeded = a.action(FL.flushIfNeeded(flushAction)),
            renderMessage = a.sequence([render, flushIfNeeded]),
            renderAction = a.sequence([replyCallback, render, flushIfNeeded]),
            reloadInterfaceAction = reloadInterface,

            renderMessageWrapper = (c: { action: CA.AppChatAction<R, H> }) =>
                a.action(FL.deferredRender(c)),
            renderActionWrapper = (c: { action: CA.AppChatAction<R, H> }) =>
                a.action(CA.chain(({ chatdata }) => chatdata.bufferActions
                    ? FL.deferredRender(c)
                    : c.action)
                ),
            defaultMessageHandler = a.sequence([
                applyInputHandler,
                CA.addRenderedUserMessage(),
                TR.saveToTrackerAction(),
                // FL.addUserMessageIfNeeded(),
                applyEffects,
                renderMessageWrapper({ action: renderMessage })
            ]),
            handleAction = a.sequence([
                applyActionHandler,
                applyEffects,
                renderActionWrapper({ action: renderAction }),
            ]),
            handleMessage = a.action(CA.chain(
                ({ tctx, chatdata }) =>
                    chatdata.reloadOnStart && CA.ifStart(tctx)
                        ? a.actionF(reloadInterfaceAction)
                        : defaultMessageHandler))
            ,
            defaultReducerCons = defaultReducer,
            useTracking = true,
        } = {}
    ) => ({
        render, renderMessage, renderAction, reloadInterfaceAction,
        flushAction, flushIfNeeded, applyEffects, applyInputHandler,
        applyActionHandler, renderMessageWrapper, renderActionWrapper,
        handleAction, handleMessage, defaultReducerCons, replyCallback,
        useTracking
    })

type AB<R, H, P, ReqContext, T, Ext, StateDeps = unknown> = AppBuilder<R, H, WithComponent<P, ReqContext>
    & AP.WithState<R, StateDeps> & Ext, ReqContext>

export const addHandlers = <R extends DefaultState, H, Ext, ReqContext, P, T, StateDeps>
    (a: AB<R, H, P, ReqContext, T, Ext, StateDeps>, actions = getDefaultActions(a)()) => {
    return pipe(a
        , AP.extend0({
            chatActions: actions
            , handleAction: actions.handleAction
            , handleMessage: actions.handleMessage
        })
    )
}

export type DefaultChatActions<R, H> = {
    render: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    renderMessage: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    renderAction: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    reloadInterfaceAction: <R, H>() => CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    flushAction: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    flushIfNeeded: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    applyEffects: <R, H, E>(ctx: CA.ChatActionContext<R, H, E>) => Promise<ChatState<R, H>>;
    applyInputHandler: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    applyActionHandler: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    renderMessageWrapper: (c: {
        action: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    }) => CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    renderActionWrapper: (c: {
        action: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    }) => CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    handleAction: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    handleMessage: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    defaultReducerCons: <R, H, E>() => ChatActionReducer<AP.DefaultActions<R, H>, R, H, E>;
    replyCallback: <R, H, E>({ tctx, chatdata }: CA.ChatActionContext<R, H, E>) => Promise<ChatState<R, H>>;
    useTracking: boolean;
}

export type WithChatActions<R, H, ChatActions> = { chatActions: ChatActions; }


export type DefaultBuild<R, H, Props, ContextReq, T, Ext, StateDeps> = AppBuilder<R, H,
    & Ext
    & AP.WithComponent<Props, ContextReq>
    & AP.WithState<R, StateDeps>
    & AP.WithRender<R, H, unknown, ContextReq>
    & AP.WithReducer<FL.Flush | AP.DefaultActions<R, H>, R, H>
    & WithChatActions<R, H, DefaultChatActions<R, H>>
    & AP.WithHandleEvent<R, H>
    & AP.WithHandlerMessage<R, H>
    & AP.WithHandlerAction<R, H>
    & AP.WithInit<R, H, { cleanOldMessages?: boolean | undefined }>
    & AP.WithProps<{}>
    , ContextReq
>

export const defaultBehaviour = <R extends DefaultState, H, Ext, ReqContext, P, T, StateDeps>
    (a: AB<R, H, P, ReqContext, T, Ext, StateDeps>)
    : DefaultBuild<R, H, P, ReqContext, T, Ext, StateDeps> => {

    const actions = getDefaultActions(a)()

    return pipe(a
        , AP.extend(AP.handleEventExtension2)
        , AP.extend(AP.renderExtension)
        , AP.extend(AP.withDefaultReducer2(actions.defaultReducerCons))
        , AP.addReducer(_ => FL.flushReducer(actions.flushAction))
        , a => addHandlers(a, actions)
        , AP.extend0(({
            init: ({ cleanOldMessages = true } = {}) => a.sequence([
                CA.onTrue(actions.useTracking, TR.initTrackingRenderer({ cleanOldMessages })),
            ])
        }))
        , AP.props({})
    )
}

export type ExtensionArg<R, RootComponent, Props, T, StateDeps, Ext, Ctx, H extends AppActionsFlatten<RootComponent>> =
    DefaultBuild<R, H, Props, Ctx, T, Ext, StateDeps>

export type ExtensionReturn<R, RootComponent, Props, T, StateDeps, Ext, Ctx, H extends AppActionsFlatten<RootComponent>,
    ReducerActions =
    | H
    | FL.Flush
    | AP.DefaultActions<R, H>
    > = ReplaceExt<
        'reducer',
        ExtensionArg<R, RootComponent, Props, T, StateDeps, Ext, Ctx, H>,
        AP.WithReducer<ReducerActions,
            R, H>
    >


export type Extensions<R, RootComponent, Props, T, StateDeps, Ext1, Ctx, H extends AppActionsFlatten<RootComponent>> =
    (a: DefaultBuild<R, H, Props, Ctx, T, {}, StateDeps>) =>
        ExtensionReturn<R, RootComponent, Props, T, StateDeps, Ext1, Ctx, H>

export function defaultBuild<
    StateDeps,

    R extends DefaultState,
    Props,
    AAA extends If<H,
        | FL.Flush
        | AP.DefaultActions<R, H>,
        {
            extensions?: Extensions<R, RootComponent, Props, T, StateDeps, Ext1, Ctx, H>
        },
        {
            extensions: Extensions<R, RootComponent, Props, T, StateDeps, Ext1, Ctx, H>
        }>,
    Ctx,
    H extends AppActionsFlatten<RootComponent>,
    RootComponent extends ComponentElement,
    T extends StateConstructor<StateDeps, R>,
    Ext1,
    >(
        app0: AppDef3<Props, RootComponent, R, StateDeps, Ctx, H> & AAA
    ) {

    const extensions =
        (a: DefaultBuild<R, H, Props, Ctx, T, {}, StateDeps>) =>
            a as ExtensionReturn<R, RootComponent, Props, T, StateDeps, Ext1, Ctx, H>

    const app = {
        extensions,
        ...app0
    } as
        AppDef3<Props, RootComponent, R, StateDeps, Ctx, H> & {
            extensions: (b:
                DefaultBuild<R, H, Props, Ctx, T, {}, StateDeps>) =>
                ExtensionReturn<R, RootComponent, Props, T, StateDeps, Ext1, Ctx, H>
        }

    return build3(defaultBehaviour, app)
}

// type ExtensionReturn2<R, RootComponent, Props, T, StateDeps, Ext1, Ctx, H extends AppActionsFlatten<RootComponent>> =
//     AppBuilder<R, H,
//         & AP.WithComponent<Props, Ctx>
//         & AP.WithState<R, StateDeps>
//         & AP.WithRender<R, H, unknown, Ctx>

//         & AP.WithReducer<
//             | H
//             | FL.Flush
//             | AP.DefaultActions<R, H>
//             ,
//             R, H
//         >

//         & DE.WithChatActions<R, H, DefaultChatActions<R, H>>
//         & AP.WithHandleEvent<R, H>
//         & AP.WithHandlerMessage<R, H>
//         & AP.WithHandlerAction<R, H>
//         & AP.WithInit<R, H, { cleanOldMessages?: boolean | undefined }>
//         & AP.WithProps<{}>
//         & Ext1
//         , Ctx
//     >