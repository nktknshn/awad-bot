import { pipe } from "fp-ts/lib/function";
import * as CA from 'Lib/chatactions';
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import * as AP from 'Lib/newapp';
import { WithComponent } from "Lib/newapp";
import { ChatActionReducer, chatStateAction, defaultReducer, reducer } from 'Lib/reducer';
import { AppBuilder } from "Lib/appbuilder";
import { BasicAppEvent, GetState } from "./types-util";
import { ChatState } from "./chatstate";

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
export type AnyFunction<A = any> = (...input: any[]) => A
export type AnyConstructor<A = object> = new (...input: any[]) => A

export type Mixin<T extends AnyFunction> = InstanceType<ReturnType<T>>


export const addDefaultBehaviour2 = <R extends DefaultState, H, Ext, ReqContext, P, T>
    (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>) => {
    // return (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>) =>
    //     addDefaultBehaviour(a, f(a)())
    return [a, getDefaultActions(a)] as const
}

export const modifyActions = <R extends DefaultState, H, Ext, ReqContext, P, T>
    (a: AB<R, H, P, ReqContext, T, Ext>) => {
    // return (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>) =>
    //     addDefaultBehaviour(a, f(a)())
    const actions = getDefaultActions(a)()

    return {
        a,
        modify: (f: (arg: typeof actions) => Partial<typeof actions>) =>
            addHandlers(a, getDefaultActions(a)(f(actions)))
    }

    // return (f: (a: AB<R, H, P, ReqContext, T, Ext>, arg: typeof actions) => Partial<typeof actions>) => 
    // addDefaultBehaviour(a, getDefaultActions(a)(f(a, actions)))
}

// export const getDefaultActions2 = <R extends DefaultState, H, Ext, ReqContext, P, T>
// (ac = getDefaultActions(a)) => {
//     return pipe(
//         getDefaultActions(a)
//         , ([a, actions]) => getDefaultActions(a, ac)
//     )
// }

export const getDefaultActions = <R extends DefaultState, H, Ext, ReqContext, P, T>
    (a: AB<R, H, P, ReqContext, T, Ext>) => (
        {
            render = a.action(CA.render),
            flushAction = a.action(CA.withChatState(s => s.flushAction())),
            flushIfNeeded = a.action(FL.flushIfNeeded(flushAction)),
            renderMessage = a.sequence([render, flushIfNeeded]),
            replyCallback = CA.replyCallback,
            renderAction = a.sequence([replyCallback, render, flushIfNeeded]),
            reloadInterfaceAction = reloadInterface,
            applyEffects = CA.applyEffects,
            applyInputHandler = a.action(CA.applyInputHandler),
            applyActionHandler = a.action(CA.applyActionHandler),
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
        handleAction, handleMessage, defaultReducerCons, replyCallback, useTracking
    })

type AB<R, H, P, ReqContext, T, Ext> = AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>

export const addHandlers = <R extends DefaultState, H, Ext, ReqContext, P, T>
    (a: AB<R, H, P, ReqContext, T, Ext>, actions = getDefaultActions(a)()) => {
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

type WithChatActions<R, H, ChatActions> = { chatActions: ChatActions; }

export type BuildBase<BaseState, BaseActions, ReducerActions, ChatActions, InitDeps> =
    AppBuilder<BaseState, BaseActions,
        & AP.WithRender<BaseState, BaseActions, unknown, unknown>
        & AP.WithReducer<ReducerActions, BaseState, BaseActions>
        & AP.WithHandleEvent<BaseState, BaseActions>
        & Record<'handleMessage', CA.AppChatAction<BaseState, BaseActions>>
        & Record<'handleAction', CA.AppChatAction<BaseState, BaseActions>>
        & AP.WithInit<BaseState, BaseActions, InitDeps>
        & WithChatActions<BaseState, BaseActions, ChatActions>
        , unknown>

export type DefaultBuild0 = BuildBase<
    DefaultState,
    unknown,
    AP.DefaultActions<DefaultState, unknown>,
    DefaultChatActions<DefaultState, unknown>,
    {}>

export type DefaultBuild<R, H, P, ReqContext, T, Ext = {}> = AppBuilder<R, H,
    &Ext
    & AP.WithComponent<P, ReqContext>
    & AP.WithState<T>
    & AP.WithRender<R, H, unknown, ReqContext>
    & AP.WithReducer<AP.DefaultActions<R, H>, R, H>
    & WithChatActions<R, H, DefaultChatActions<R, H>>
    & AP.WithHandleEvent<R, H>
    & Record<'handleMessage', CA.AppChatAction<R, H>>
    & Record<'handleAction', CA.AppChatAction<R, H>>
    & AP.WithInit<R, H, { cleanOldMessages?: boolean | undefined }>
    & AP.WithProps<{}>, ReqContext>
    // & AP.WithContextCreator<GetState<T>, ReqContext>


export const defaultBehaviour = <R extends DefaultState, H, Ext, ReqContext, P, T>
    (a: AB<R, H, P, ReqContext, T, Ext>) => {
    // : DefaultBuild<R, H, P, ReqContext, T> => {

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


// type PartialAppBuilder<R, H, Actions, ChatActions, InitDeps, Ext> =
//     AppBuilder<R, H,
//         & AP.WithRender<R, H, unknown, unknown>
//         & AP.WithReducer<Actions, R, H>
//         & AP.WithHandleEvent<R, H>
//         & Record<'handleMessage', CA.AppChatAction<R, H>>
//         & Record<'handleAction', CA.AppChatAction<R, H>>
//         & AP.WithInit<R, H, InitDeps>
//         & WithChatActions<R, H, ChatActions>
//         , unknown>

// export const defaultBehaviour0 =
//     <R, H, Actions, ChatActions, InitDeps, Ext>(
//         a: PartialAppBuilder<R, H, Actions, ChatActions, InitDeps, Ext>
//     )
//         : PartialAppBuilder<
//             R & DefaultState,
//             H,
//             AP.DefaultActions<DefaultState, H>,
//             DefaultChatActions<DefaultState, H>,
//             { cleanOldMessages?: boolean | undefined }, Ext> => {

//         return pipe(a
//             , AP.extend(AP.handleEventExtension2)
//             , AP.extend(AP.renderExtension)
//             , AP.extend(AP.withDefaultReducer2(actions.defaultReducerCons))
//             , AP.addReducer(_ => FL.flushReducer(actions.flushAction))
//             , a => addHandlers(a, actions)
//             , AP.extend0(({
//                 init: ({ cleanOldMessages = true } = {}) => a.sequence([
//                     CA.onTrue(actions.useTracking, TR.initTrackingRenderer({ cleanOldMessages })),
//                 ])
//             }))
//             , AP.props({})
//         )
//     }
