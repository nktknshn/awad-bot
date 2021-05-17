import { pipe } from 'fp-ts/lib/pipeable';
import * as AP from 'Lib/newapp';
import { TelegrafContext } from 'telegraf/typings/context';
import { AppBuilder, startBuild, startBuild0 } from "./appbuilder";
import { ChatState } from "./chatstate";
import { ComponentElement } from './component';
import { BuildBase, defaultBehaviour, DefaultBuild, DefaultChatActions, DefaultState } from './defaults';
import { CA, DE } from './lib';
import { WithComponent, WithHandleEvent } from "./newapp";
import { AppActionsFlatten, ComponentReqs, GetState } from "./types-util";

type AB<R, H, P, ReqContext, T> =
    AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<T>, ReqContext>

export type AppDef<
    ContextReq extends ComponentReqs<RootComponent>, Props, T,
    RootComponent extends ComponentElement, Ctx extends ContextReq,
    Ext1, R, H
    > =
    {
        component: (props: Props) => RootComponent
        state: T,
        props?: Props,
        context: (cs: ChatState<GetState<T>, unknown>) => Ctx,
        extensions: (a:
            DefaultBuild<R, H, Props, ContextReq, T>) =>
            DefaultBuild<R, H, Props, ContextReq, T, Ext1>
    }



export const build3 = <
    ContextReq extends ComponentReqs<RootComponent>, Props, T,
    RootComponent extends ComponentElement, Ctx extends ContextReq, Ext1, H1
>
    (
        func: (a: AppBuilder<GetState<T>, AppActionsFlatten<RootComponent>,
            WithComponent<Props, ContextReq> & AP.WithState<T>, ContextReq>) =>

            DefaultBuild<GetState<T>, AppActionsFlatten<RootComponent>, Props, ContextReq, T>,

        app: AppDef<ContextReq, Props, T, RootComponent, Ctx, Ext1,
            GetState<T>, AppActionsFlatten<RootComponent>>) =>

    pipe(
        app
        , getBuild
        , func
        , app.extensions
        , AP.context(app.context)
    )

export const getBuild = <
    ContextReq extends ComponentReqs<RootComponent>, Props, T,
    RootComponent extends ComponentElement, Ctx extends ContextReq,
    Ext1, StateDeps, H1,
    R, H = AppActionsFlatten<RootComponent>
>(app: AppDef<
    ContextReq, Props, T, RootComponent, Ctx,
    Ext1,
    GetState<T>, AppActionsFlatten<RootComponent>
>): AppBuilder<GetState<T>, AppActionsFlatten<RootComponent>,
    WithComponent<Props, ContextReq>
    & AP.WithState<T>
    , ContextReq> =>
    pipe(
        startBuild0()
        , AP.component(app.component)
        , AP.state(app.state)
        // , AP.context(app.context)
    )

type HHH<T> = T extends AppDef<infer ContextReq, infer Props, infer T,
    infer RootComponent, infer Ctx, infer Ext1, infer R, infer H> ? Ext1 : never