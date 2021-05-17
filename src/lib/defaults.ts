import { pipe } from "fp-ts/lib/function";
import * as CA from 'Lib/chatactions';
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import * as AP from 'Lib/newapp';
import { WithComponent } from "Lib/newapp";
import { chatStateAction, defaultReducer, reducer } from 'Lib/reducer';
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

// export class DefaultRender<R extends DefaultState, H, Ext, ReqContext> {
//     constructor(public readonly a: AppBuilder<R, H, Ext, ReqContext>) { }

//     render = this.a.action(CA.render)
//     flushAction = this.a.action(CA.withChatState(s => s.flushAction()))
//     flushIfNeeded = this.a.action(FL.flushIfNeeded(this.flushAction))
//     renderMessage = this.a.sequence([this.render, this.flushIfNeeded])
//     renderAction = this.a.sequence([this.render, this.flushIfNeeded, CA.replyCallback])
//     reloadInterfaceAction = reloadInterface
//     applyEffects = CA.applyEffects
//     applyInputHandler = this.a.action(CA.applyInputHandler)
//     applyActionHandler = this.a.action(CA.applyActionHandler)
//     renderWrapperMessage = FL.deferredRender
//     renderWrapperAction = (action: CA.AppChatAction<R, H>) => this.a.action(
//         CA.chain(({ chatdata }) => chatdata.bufferActions
//             ? FL.deferredRender({ action })
//             : action)
//     )
// }

// function getdef<R extends DefaultState, H, Ext, ReqContext, P, T>
//     (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>) {
//     class DefaultRender {
//         render = a.action(CA.render)
//         flushAction = a.action(CA.withChatState(s => s.flushAction()))
//         flushIfNeeded = a.action(FL.flushIfNeeded(this.flushAction))
//         renderMessage = a.sequence([this.render, this.flushIfNeeded])
//         renderAction = a.sequence([this.render, this.flushIfNeeded, CA.replyCallback])
//         reloadInterfaceAction = reloadInterface
//         applyEffects = CA.applyEffects
//         applyInputHandler = a.action(CA.applyInputHandler)
//         applyActionHandler = a.action(CA.applyActionHandler)
//         renderWrapperMessage = FL.deferredRender
//         renderWrapperAction = (action: CA.AppChatAction<R, H>) => a.action(
//             CA.chain(({ chatdata }) => chatdata.bufferActions
//                 ? FL.deferredRender({ action })
//                 : action)
//         )
//     }

//     return new DefaultRender()
// }

// export type DefaultEnv<R extends DefaultState, H, Ext> = WithEnv<DefaultRenderActions<R, H>>

// type WithEnv<T> = {
//     env?: (e: T) => T
// }

// export function addEnv<R extends DefaultState, H, Ext, ReqContext, P, T>(
//     f: (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>) =>
//         (d: DefaultRenderActions<R, H>) => DefaultRenderActions<R, H>
// ) {
//     return function (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>): AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & DefaultEnv<R, H, Ext> & Ext, ReqContext> {
//         return pipe(a, AP.extend(a => ({
//             env: f(a)
//         })))
//     }
// }

// export type DefaultRenderActions<R extends DefaultState, H> = {
//     render: CA.AppChatAction<R, H>,
//     renderMessage: CA.AppChatAction<R, H>,
//     renderAction: CA.AppChatAction<R, H>,
//     reloadInterfaceAction: () => CA.AppChatAction<R, H>,
//     flushAction: CA.AppChatAction<R, H>,
//     flushIfNeeded: CA.AppChatAction<R, H>,
//     applyEffects: CA.AppChatAction<R, H>,
//     applyInputHandler: CA.AppChatAction<R, H>,
//     applyActionHandler: CA.AppChatAction<R, H>,
//     renderWrapperMessage: (action: CA.AppChatAction<R, H>) => CA.AppChatAction<R, H>,
//     renderWrapperAction: (action: CA.AppChatAction<R, H>) => CA.AppChatAction<R, H>,
// }

export const addDefaultBehaviour2 = <R extends DefaultState, H, Ext, ReqContext, P, T>
    (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>) => {
    // return (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>) =>
    //     addDefaultBehaviour(a, f(a)())
    return [a, getDefaultActions(a)] as const
}

export const updateActions = <R extends DefaultState, H, Ext, ReqContext, P, T>
    (a: AB<R, H, P, ReqContext, T, Ext>) => {
    // return (a: AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>) =>
    //     addDefaultBehaviour(a, f(a)())
    const actions = getDefaultActions(a)()

    return {
        a,
        updateActions: (f: (arg: typeof actions) => Partial<typeof actions>) =>
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
            renderAction = a.sequence([CA.replyCallback, render, flushIfNeeded]),
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
        handleAction, handleMessage, defaultReducerCons, useTracking
    })

type AB<R, H, P, ReqContext, T, Ext> = AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T> & Ext, ReqContext>

export const addHandlers = <R extends DefaultState, H, Ext, ReqContext, P, T>
    (a: AB<R, H, P, ReqContext, T, Ext>, actions = getDefaultActions(a)({})) => {
    return pipe(a
        , AP.extend0({
            chatActions: actions
            , handleAction: actions.handleAction
            , handleMessage: actions.handleMessage
        })
    )
}


export const addDefaultBehaviour = <R extends DefaultState, H, Ext, ReqContext, P, T>
    (a: AB<R, H, P, ReqContext, T, Ext>, actions = getDefaultActions(a)({})) => {

    return pipe(a
        , AP.extend(AP.handleEventExtension2)
        , AP.extend(AP.renderExtension)
        , AP.extend(AP.withDefaultReducer2(actions.defaultReducerCons))
        , AP.addReducer(_ => FL.flushReducer(actions.flushAction))
        , AP.extend0({
            chatActions: actions
            , handleAction: actions.handleAction
            , handleMessage: actions.handleMessage
            , defaultInit: ({ cleanOldMessages = true } = {}) => a.sequence([
                CA.onTrue(actions.useTracking, TR.initTrackingRenderer({ cleanOldMessages })),
            ])
        })
        , AP.extend(_ => ({
            init: _.ext.defaultInit
        }))
        , AP.props({})
    )
}
