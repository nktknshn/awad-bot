import * as E from 'fp-ts/lib/Either';
import { pipe } from "fp-ts/lib/pipeable";
import { startBuild } from "Lib/appbuilder";
import { createLevelTracker, runbot } from "Lib/botmain";
import { withTrackingRenderer } from "Lib/components/actions/tracker";
import { addDefaultBehaviour, defaultState, withStore } from "Lib/defaults";
import { AP, CA, chatState, FL } from 'Lib/lib';
import { storef } from "Lib/storeF";
import { GetState, RequiredKeepUndefined } from "Lib/types-util";
import { dirToVault, readdirRe1 } from "./obs";
import { Store, storeActions } from './store';
import { App } from './components/App';
import { defaultReducer, reducer } from 'Lib/reducer';
import { mylog } from 'Lib/logging';
import { timerState, withTimer } from 'Lib/components/actions/rendertimer';
export { App } from './components/App';

export const store = async (dir: string) =>
    readdirRe1(dir)
        .then(
            E.fold(error => ({ error: error.message }) as RequiredKeepUndefined<Store>, vault => ({
                vault: dirToVault(vault),
                error: undefined,
                openFile: undefined,
                openFileContent: undefined,
                openDir: undefined,
                expandedDirs: []
            }))
        ).then(
            res => storef<Store>(res)
        )

const state = (d: { vaultPath: string }) => chatState([
    defaultState(),
    withTrackingRenderer(createLevelTracker('mydb_bot7')),
    async () => ({
        store: await store(d.vaultPath)
    }),
    timerState,
])

export const stateToContext = (cs: GetState<typeof state>) => ({
    vault: cs.store.state.vault,
    error: cs.store.state.error,
    openFile: cs.store.state.openFile,
    storeActions: storeActions(cs.store),
    openFileContent: cs.store.state.openFileContent,
    openDir: cs.store.state.openDir,
    expandedDirs: cs.store.state.expandedDirs,
})

export const { createApplication } = pipe(
    startBuild(App, state)
    , withTimer
    , a => addDefaultBehaviour(a, {
        render: CA.sequence([
            CA.log(ctx => {
                mylog('addDefaultBehaviour render');
            }),
            CA.render,
            a.ext.stopTimer,
            CA.log(({ chatdata }) => {
                mylog(`duration: ${chatdata.timerDuration}`)
            })])
        , applyActionHandler: a.actions([
            a.ext.startTimer
            , CA.log((ctx) => {
                console.log('\n\n\n\n\n')
                mylog('applyActionHandler');
            })
            , CA.applyActionHandler])
        , applyInputHandler: a.actions([
            a.ext.startTimer
            , CA.log((ctx) => {
                console.log('\n\n\n\n\n')
                mylog('applyInputHandler')
            })
            , CA.applyInputHandler])
    })
    , a => withStore(a, {
        storeKey: 'store',
        storeAction: apply =>
            a.actions([
                CA.log(_ => mylog('storeAction apply')),
                apply,
                FL.deferredRender({
                    waitForTimer: true,
                    action: CA.sequence([
                        CA.log(_ => mylog('storeAction render deferredRender'))
                        , CA.render
                        , a.ext.stopTimer
                        , CA.log(({ chatdata }) => {
                            mylog(`duration: ${chatdata.timerDuration}`)
                        })
                    ])
                }),
            ])
    })
    , AP.context(stateToContext)
    , AP.props({
        expandAll: false
    })
    , AP.withInit(a => a.actions([a.ext.defaultInit(), a.ext.attachStore_store]))
    , a => AP.complete(a)
    , AP.extend(_ => ({
        actionReducer: (a: Parameters<typeof _.ext.actionReducer>[0]) => {
            // mylog('actionReducer');
            mylog(a);

            return _.ext.actionReducer(a)
        }
    }))
    , AP.extend(_ => ({
        handleEvent: (a: Parameters<typeof _.ext.handleEvent>[0], e: Parameters<typeof _.ext.handleEvent>[1]) => {
            mylog('handleEvent');
            mylog(e);

            return _.ext.handleEvent(a, e)
        }
    }))
    , AP.withCreateApplication
)
