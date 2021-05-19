// import { pipe } from 'fp-ts/lib/pipeable';
// import * as AP from 'Lib/newapp';
// import { TelegrafContext } from 'telegraf/typings/context';
// import { AppBuilder, startBuild, startBuild0 } from "./appbuilder";
// import { ChatState } from "./chatstate";
// import { ComponentElement } from './component';
// import { BuildBase, DefaultBuild, DefaultChatActions, DefaultState } from './defaults';
// import { CA } from './lib';
// import { WithComponent, WithHandleEvent } from "./newapp";
// import { AppActionsFlatten, ComponentReqs, GetState } from "./types-util";

// type AB<R, H, P, ReqContext, T, StateDeps> =
//     AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<R, StateDeps>, ReqContext>

// export type AppDef<
//     ContextReq extends ComponentReqs<RootComponent>, Props, T,
//     RootComponent extends ComponentElement, Ctx extends ContextReq,
//     Ext1, R , H, StateDeps
//     > =
//     {
//         component: (props: Props) => RootComponent
//         state: T,
//         props?: Props,
//         // behaviour
//         // base: (a: AB<R, H, Props, ContextReq, T>) =>
//             // DefaultBuild<R, H, Props, AP.DefaultActions<R, H>, DefaultChatActions<R, H>>

//         context: (cs: ChatState<R, unknown>) => Ctx,
//         extensions: (a: AppBuilder<R, H,

//             WithComponent<Props, ContextReq> & AP.WithState<R, StateDeps>
//             , ContextReq>) =>
            
//             AppBuilder<R, H, WithComponent<Props, ContextReq>
//                 & AP.WithState<R, StateDeps> & Ext1, ContextReq>,
//     }

// export const build = <
//     ContextReq extends ComponentReqs<RootComponent>, Props, T,
//     RootComponent extends ComponentElement, Ctx extends ContextReq, Ext1, R , StateDeps
//     >
//     (app: AppDef<ContextReq, Props, T, RootComponent, Ctx,

//         // WithComponent<Props, ContextReq>
//         // & AP.WithState<T>, 

//         Ext1 & WithComponent<Props, ContextReq>
//         & AP.WithState<R, StateDeps>,
//         // DefaultBuild<R, H, Props, ContextReq, T, {}>,

//         R, AppActionsFlatten<RootComponent>, StateDeps>) =>
//     app

// export const getApp = <
//     ContextReq extends ComponentReqs<RootComponent>, Props, T,
//     RootComponent extends ComponentElement, Ctx extends ContextReq,
//     Ext1, StateDeps, H1,
//     R extends GetState<T> = GetState<T> , H = AppActionsFlatten<RootComponent>
// >(app: AppDef<

//     ContextReq, Props, T, RootComponent, Ctx,

//     Ext1
//     & WithComponent<Props, ContextReq>
//     & AP.WithState<R, StateDeps>
//     & WithHandleEvent<GetState<T>, AppActionsFlatten<RootComponent>>
//     & Record<'handleMessage', CA.AppChatAction<R, AppActionsFlatten<RootComponent>>>
//     & Record<'handleAction', CA.AppChatAction<R, AppActionsFlatten<RootComponent>>>
//     & AP.WithRender<GetState<T>, AppActionsFlatten<RootComponent>, Props, Ctx>
//     & AP.WithReducer<H1 | AppActionsFlatten<RootComponent>, R, AppActionsFlatten<RootComponent>>
//     & WithComponent<Props, ContextReq>
//     & AP.WithProps<Props>
//     & AP.WithState<(d: StateDeps) => (tctx: TelegrafContext) =>
//         Promise<ChatState<GetState<T>, AppActionsFlatten<RootComponent>>>>
//     ,
//     GetState<T>, AppActionsFlatten<RootComponent>, StateDeps
// >) =>
//     pipe(
//         startBuild0()
//         , AP.component(app.component)
//         , AP.state(app.state)
//         , app.extensions
//         , AP.context(app.context)
//         // , AP.complete
//         // , AP.overload('actionReducer', _ => (a) => {
//         //     mylog(a);
//         //     return _.ext.actionReducer(a)
//         // })
//         // , AP.overload('handleEvent', _ => (ctx, e) => {
//         //     mylog(e);
//         //     return _.ext.handleEvent(ctx, e)
//         // })
//         // , a => a
//         // , AP.withCreateApplication
//     )

// export const getApp2 = <
//     ContextReq extends ComponentReqs<RootComponent>, Props, T,
//     RootComponent extends ComponentElement, Ctx extends ContextReq,
//     Ext1, StateDeps, H1,
//     R , H = AppActionsFlatten<RootComponent>
// >(app: AppDef<

//     ContextReq, Props, T, RootComponent, Ctx,

//     Ext1
//     // & WithComponent<Props, ContextReq>
//     // & AP.WithState<T>
//     // & WithHandleEvent<R, AppActionsFlatten<RootComponent>>
//     // & Record<'handleMessage', CA.AppChatAction<R, AppActionsFlatten<RootComponent>>>
//     // & Record<'handleAction', CA.AppChatAction<R, AppActionsFlatten<RootComponent>>>
//     // & AP.WithRender<R, AppActionsFlatten<RootComponent>, Props, Ctx>
//     // & AP.WithReducer<H1 | AppActionsFlatten<RootComponent>, R, AppActionsFlatten<RootComponent>>
//     // & WithComponent<Props, ContextReq>
//     // & AP.WithProps<Props>
//     // & AP.WithState<(d: StateDeps) => (tctx: TelegrafContext) =>
//     //     Promise<ChatState<R, AppActionsFlatten<RootComponent>>>>
//     ,
//     GetState<T>, AppActionsFlatten<RootComponent>, StateDeps
// >) =>
//     pipe(
//         startBuild0()
//         , AP.component(app.component)
//         , AP.state(app.state)
//         , AP.context(app.context)
//     )

// type HHH<T> = T extends AppDef<infer ContextReq, infer Props, infer T,
//     infer RootComponent, infer Ctx, infer Ext1, infer R, infer H, infer StateDeps> ? Ext1 : never