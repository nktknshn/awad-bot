import * as F from 'fp-ts/lib/function';
import {
    createActionEvent
} from "Lib/event";
import { BasicAppEvent } from "Lib/types-util";
import { pipe } from "fp-ts/lib/function";
import * as CA from 'Lib/chatactions';
import * as AP from 'Lib/newapp';
import { WithReducer } from "Lib/newapp";
import { storeReducer } from 'Lib/reducer';
import { StoreF2 } from 'Lib/storeF';
import { AppBuilder } from "Lib/appbuilder";
import { DefaultState } from "Lib/defaults";

export const connectFStore =
    <R extends Record<K, StoreF2<unknown,unknown>>, H, K extends keyof any = 'store'>
        (u: AppBuilder<R, H, {}, {}>, key: K) =>
        u.action(
            async ({ app, queue, chatdata }) => ({
                ...chatdata,
                [key]: chatdata[key].withDispatch(
                    F.flow(
                        app.actionReducer,
                        createActionEvent,
                        queue.handleEvent()
                    )
                )
            })
        )

type WithStoreArgs<R, H, K extends keyof R> = {
    storeKey: K;
    storeAction?: (apply: CA.AppChatAction<R, H>) => CA.AppChatAction<R, H>;
};

export const withStore = <
    R extends DefaultState & Record<K, StoreF2<unknown, unknown>>, H, Ext, RootComp, H1, Deps,
    K extends keyof R>(a: AppBuilder<R, H,
        WithReducer<H1, R, H> & Ext & AP.WithInit<R,H,Deps>, RootComp>, {
            storeKey,
            storeAction = apply => a.sequence([apply, CA.render])
        }: WithStoreArgs<R, H, K>): AppBuilder<R, H,
            Ext 
            & Record<`attachStore`, CA.AppChatAction<R, H>> 
            & WithReducer<H1 | Parameters<R[K]["applyAction"]>[0]
            & AP.WithInit<R,H,Deps>
            , R, H>,
            RootComp> => pipe(a
                , AP.attachStore(storeKey)
                , AP.extend(a => ({
                    init: (deps: Deps) => a.sequence([
                        a.ext.init ? a.ext.init(deps): CA.doNothing,
                        a.ext.attachStore
                    ])
                }))
                , AP.addReducer(_ => storeReducer(storeKey, storeAction))
            );
