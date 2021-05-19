import { flow } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";
import { createLevelTracker } from "Lib/botmain";
import { timerState, withTimer } from 'Lib/components/actions/rendertimer';
import { withStore } from "Lib/components/actions/store";
import { withTrackingRenderer } from "Lib/components/actions/tracker";
import { defaultBuild, defaultState } from "Lib/defaults";
import { AP, CA, chatState, DE, T } from 'Lib/lib';
import { mylog } from 'Lib/logging';
import { storef } from "Lib/storeF";
import { GetChatState } from "Lib/types-util";
import { App } from './components/App';
import { readStore, Store, storeActions } from './store';
export { App } from './components/App';

const log = <R, H>(f: ((chatdata: R) => string) | string, logger = mylog) => CA.log<R, H>(ctx => {
    logger((typeof f === 'string' ? () => f : f)(ctx.chatdata));
})

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
    async () => ({
        store: await store(d.vaultPath)
    }),
    timerState,
])

export const context = (cs: GetChatState<typeof state>) => ({
    vault: cs.store.state.vault!,
    vaultConfig: cs.store.state.vaultConfig!,
    error: cs.store.state.error,
    openFile: cs.store.state.openFile,
    openFileContent: cs.store.state.openFileContent,
    openDir: cs.store.state.openDir,
    expandedDirs: cs.store.state.expandedDirs,
    storeActions: storeActions(cs.store),
})


const app2 = defaultBuild({
    component: App, state, context,
    extensions: flow(
        withTimer
        , DE.modifyActions
        , ({ a, modify }) => modify(actions => ({
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
        , AP.overload('handleEvent', _ => (ctx, e) => {
            mylog(e);
            return _.ext.handleEvent(ctx, e)
        })
    )
})


export const { createApplication } = AP.withCreateApplication(app2)