import { pipe } from "fp-ts/lib/pipeable";
import { AppBuilder, Defined, startBuild, startBuild0 } from "Lib/appbuilder";
import { createLevelTracker } from "Lib/botmain";
import { timerState, withTimer } from 'Lib/components/actions/rendertimer';
import { withTrackingRenderer } from "Lib/components/actions/tracker";
import { addDefaultBehaviour, defaultState, getDefaultActions } from "Lib/defaults";
import { withStore } from "Lib/components/actions/store";
import { AP, CA, chatState, DE, T } from 'Lib/lib';
import { mylog } from 'Lib/logging';
import { storef } from "Lib/storeF";
import { AppActionsFlatten, ComponentReqs, FindKey, GetAllComps, GetComponent, GetRootState, GetState, MakeUnion, StatesKeys } from "Lib/types-util";
import { App } from './components/App';
import { readStore, Store, storeActions } from './store';
import { ChatState } from "Lib/chatstate";
import { flow } from "fp-ts/lib/function";
import { WithComponent, WithReducer, WithState } from "Lib/newapp";
import { VaultDirs } from "./components/VaultDirs";
import { VaultOpenDirFiles } from "./components/VaultOpenDirFiles";
import { OpenedFile } from "./components/OpenedFile";
export { App } from './components/App';

export const store = (dir: string) => pipe(
    readStore(dir)
    , T.map(res => {
        // console.log(res.vaultConfig?.hidden);
        return storef<Store>(res)
    })
)()

const state = (d: { vaultPath: string }) => chatState([
    defaultState(),
    withTrackingRenderer(createLevelTracker('mydb_bot7')),
    timerState,
    async () => ({
        store: await store(d.vaultPath)
    }),
])

export const context = (cs: GetState<typeof state>) => ({
    vault: cs.store.state.vault!,
    vaultConfig: cs.store.state.vaultConfig!,
    error: cs.store.state.error,
    openFile: cs.store.state.openFile,
    openFileContent: cs.store.state.openFileContent,
    openDir: cs.store.state.openDir,
    expandedDirs: cs.store.state.expandedDirs,
    storeActions: storeActions(cs.store),
})

const log = <R, H>(f: ((chatdata: R) => string) | string, logger = mylog) => CA.log<R, H>(ctx => {
    logger((typeof f === 'string' ? () => f : f)(ctx.chatdata));
})


type AppDef<
    ContextReq extends ComponentReqs<RootComponent0>,
    P, T, RootComponent0, Ctx extends ContextReq, Ext1,
    Ext0, R, H
    > =
    {
        component: (props: P) => RootComponent0
        state: T,
        context: (cs: ChatState<R, unknown>) => Ctx,
        extensions: (a: AppBuilder<R, H, Ext0, ContextReq>) =>
            AppBuilder<R, H, Ext1, ContextReq>,
    }

const build = <
    ContextReq extends ComponentReqs<RootComponent0>, P, T,
    RootComponent0, Ctx extends ContextReq, Ext1,
    >
    (app: AppDef<ContextReq, P, T, RootComponent0, Ctx, Ext1,
        WithComponent<P, ContextReq> & AP.WithState<T>, GetState<T>, AppActionsFlatten<RootComponent0>>) =>
    app

const app = build({
    component: App, state, context,
    extensions: flow(
        withTimer
        , DE.addDefaultBehaviour
        , DE.updateActions
        , ({ a, updateActions }) => updateActions(actions => ({
            render: a.sequence([
                log('addDefaultBehaviour render')
                , actions.render
                , a.ext.stopTimer
                , log(chatdata => `duration: ${chatdata.timerDuration}`)
            ])
            , applyActionHandler: a.sequence([
                a.ext.startTimer
                , log('\n\n\n\n\napplyActionHandler')
                , actions.applyActionHandler
            ])
            , applyInputHandler: a.sequence([
                a.ext.startTimer
                , log('\n\n\n\n\napplyInputHandler')
                , actions.applyInputHandler
            ])
        }))
        , a => withStore(a, {
            storeKey: 'store'
            , storeAction: apply =>
                a.sequence([
                    log('storeAction apply')
                    , apply
                    , CA.render
                    , log('storeAction render done')
                    , a.ext.stopTimer
                    , log(chatdata => `duration: ${chatdata.timerDuration}`)
                ])
        })
    )
})

export const { createApplication } = pipe(
    startBuild(app.component, app.state)
    , app.extensions
    , AP.context(app.context)
    , AP.complete
    , AP.overload('actionReducer', _ => (a) => {
        mylog(a);
        return _.ext.actionReducer(a)
    })
    , AP.overload('handleEvent', _ => (ctx, e) => {
        mylog(e);
        return _.ext.handleEvent(ctx, e)
    })
    , AP.withCreateApplication
)
