import * as E from 'fp-ts/lib/Either';
import { pipe } from "fp-ts/lib/pipeable";
import { startBuild } from "Lib/appbuilder";
import { createLevelTracker, runbot } from "Lib/botmain";
import { withTrackingRenderer } from "Lib/components/actions/tracker";
import { addDefaultBehaviour, defaultState, withStore } from "Lib/defaults";
import { AP, chatState, FL } from 'Lib/lib';
import { storef } from "Lib/storeF";
import { GetState, RequiredKeepUndefined } from "Lib/types-util";
import { dirToVault, readdirRe1 } from "./obs";
import { Store, storeActions } from './store';
import { App } from './components/App';
export { App } from './components/App';

export const store = async (dir: string) =>
    readdirRe1(dir)
        .then(
            E.fold(error => ({ error: error.message }) as RequiredKeepUndefined<Store>, vault => ({
                vault: dirToVault(vault),
                error: undefined,
                openFile: undefined,
                openFileContent: undefined,
                openDir: undefined
            }))
        ).then(
            res => storef<Store>(res)
        )

const state = (d: { vaultPath: string }) => chatState([
    defaultState(),
    withTrackingRenderer(createLevelTracker('mydb_bot7')),
    async () => ({
        store: await store(d.vaultPath)
    })
])

export const stateToContext = (cs: GetState<typeof state>) => ({
    vault: cs.store.state.vault,
    error: cs.store.state.error,
    openFile: cs.store.state.openFile,
    storeActions: storeActions(cs.store),
    openFileContent: cs.store.state.openFileContent,
    openDir: cs.store.state.openDir
})

const { createApplication } = pipe(
    startBuild(App, state)
    , addDefaultBehaviour
    , a => withStore(a, {
        storeKey: 'store', storeAction: apply => a.actions([
            apply,
            FL.deferredRender({
                waitForTimer: true
            }),
            // CA.render,
        ])
    })
    , AP.context(stateToContext)
    , AP.props({
        expandAll: false
    })
    , AP.withInit(a => a.actions([a.ext.defaultInit(), a.ext.attachStore_store]))
    , a => AP.complete(a)
    , AP.withCreateApplication
)

// runbot({
//     app: createApplication({
//         vaultPath: '/home/horn/Documents/my1'
//     })
// })