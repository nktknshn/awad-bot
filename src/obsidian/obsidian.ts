import * as E from 'fp-ts/lib/Either';
import { pipe } from "fp-ts/lib/pipeable";
import { startBuild } from "Lib/appbuilder";
import { createLevelTracker, runbot } from "Lib/botmain";
import { withTrackingRenderer } from "Lib/components/actions/tracker";
import { addDefaultBehaviour, defaultState, withStore } from "Lib/defaults";
import { AP, CA, chatState, FL, TE, T } from 'Lib/lib';
import { storef } from "Lib/storeF";
import { GetState, RequiredKeepUndefined } from "Lib/types-util";
import { dirToVault, readdirRe1, readVaultConfig } from "./obs";
import { Store, storeActions } from './store';
import { App } from './components/App';
import { defaultReducer, reducer } from 'Lib/reducer';
import { mylog } from 'Lib/logging';
import { timerState, withTimer } from 'Lib/components/actions/rendertimer';
export { App } from './components/App';

export const readStore = (dir: string) => {
    return pipe(
        readdirRe1(dir)
        , TE.map(dirToVault)
        , TE.chain(vault =>
            TE.tryCatch(
                () => readVaultConfig(vault).then(vaultConfig => ({
                    vaultConfig,
                    vault
                })),
                () => ({ message: 'error loading config' })))
        , TE.fold(
            error => async () => ({ error: error.message }) as RequiredKeepUndefined<Store>
            , ({ vaultConfig, vault }) => async () => ({
                vault,
                vaultConfig,
                error: undefined,
                openFile: undefined,
                openFileContent: undefined,
                openDir: undefined,
                expandedDirs: []
            })
        )
    )
}

export const store = (dir: string) => pipe(
    readStore(dir)
    , T.map(res => {
        console.log(res.vaultConfig?.hidden);
        
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

export const stateToContext = (cs: GetState<typeof state>) => ({
    vault: cs.store.state.vault,
    vaultConfig: cs.store.state.vaultConfig,
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

export const { createApplication } = pipe(
    startBuild(App, state)
    , withTimer
    , a => addDefaultBehaviour(a, {
        render: CA.sequence([
            log('addDefaultBehaviour render')
            , CA.render
            , a.ext.stopTimer
            , log(chatdata => `duration: ${chatdata.timerDuration}`)
        ])
        , applyActionHandler: a.actions([
            a.ext.startTimer
            , log('\n\n\n\n\napplyActionHandler')
            , CA.applyActionHandler
        ])
        , applyInputHandler: a.actions([
            a.ext.startTimer
            , log('\n\n\n\n\napplyInputHandler')
            , CA.applyInputHandler
        ])
    })
    , a => withStore(a, {
        storeKey: 'store',
        storeAction: apply =>
            a.actions([
                log('storeAction apply')
                , apply
                , FL.deferredRender({
                    waitForTimer: true,
                    action: CA.sequence([
                        log('storeAction render deferredRender')
                        , CA.render
                        , a.ext.stopTimer
                        , log(chatdata => `duration: ${chatdata.timerDuration}`)
                    ])
                }),
            ])
    })
    , AP.context(stateToContext)
    , AP.withInit(a => a.actions([a.ext.defaultInit(), a.ext.attachStore_store]))
    , a => AP.complete(a)
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
