import { pipe } from 'fp-ts/lib/pipeable';
import * as AP from 'Lib/newapp';
import { TelegrafContext } from 'telegraf/typings/context';
import { AppBuilder, startBuild, startBuild0 } from "./appbuilder";
import { ChatState } from "./chatstate";
import { ComponentElement } from './component';
import { defaultBehaviour, DefaultBuild, DefaultChatActions, DefaultState, ExtensionArg, ExtensionReturn, Extensions } from './defaults';
import { A, CA, DE } from './lib';
import { WithComponent, WithHandleEvent } from "./newapp";
import { AppActionsFlatten, ComponentReqs, GetState, If, StateConstructor } from "./types-util";

type AB<R, H, P, ReqContext, T, StateDeps> =
    AppBuilder<R, H, WithComponent<P, ReqContext> & AP.WithState<R, StateDeps>, ReqContext>

export type AppDef3<
    Props,
    RootComponent extends ComponentElement,
    R extends DefaultState, StateDeps,
    Ctx,
    H extends AppActionsFlatten<RootComponent>,
    > =
    {
        component: <A>(props: Props) => RootComponent
        state: StateConstructor<StateDeps, R>,
        context: <A>(cs: ChatState<R, H>) => Ctx,
    }

export type ReplaceExt<K extends keyof any, T, V> =
    T extends AppBuilder<infer R, infer H, infer Ext, infer ReqContext>
    ? AppBuilder<R, H, Omit<Ext, K> & V, ReqContext> : never

export const build3 = <
    Ext1, RootComponent extends ComponentElement,
     Props,
    T extends StateConstructor<StateDeps, R>,
    R extends DefaultState, StateDeps,
    Ctx,
    H extends AppActionsFlatten<RootComponent>
>
    (
        func: (a: AppBuilder<R, H,
            WithComponent<Props, Ctx> & AP.WithState<R, StateDeps>, Ctx>) =>
            ExtensionArg<R, RootComponent, Props, T, StateDeps, AP.WithState<R, StateDeps>, Ctx, H>
        , app: AppDef3<Props, RootComponent, R, StateDeps, Ctx, H>
            & Record<'extensions', Extensions<R, RootComponent, Props, T, StateDeps, Ext1, Ctx, H>>
    ) => pipe(
        app
        , getBuild3
        , func
        , app.extensions
        , a => a
        , AP.context(app.context)
        , a => AP.complete(a)
    )

export const getBuild3 = <
    Props, RootComponent extends ComponentElement,
    R extends DefaultState, H extends AppActionsFlatten<RootComponent>, Deps,
    Ctx ,

>(app: AppDef3<
    Props, RootComponent,
    R, Deps, Ctx, H
>): AppBuilder<R, H,
    WithComponent<Props, Ctx>
    & AP.WithState<R, Deps>
    , Ctx> => startBuild(app.component, app.state)
