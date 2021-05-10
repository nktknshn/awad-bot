import { pipe } from "fp-ts/lib/function";
import * as CA from 'Lib/chatactions';
import { ComponentElement } from "Lib/component";
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import * as AP from 'Lib/newapp';
import { WithComponent } from "Lib/newapp";
import { storeReducer } from 'Lib/reducer';
import { StoreF2 } from 'Lib/storeF';
import { BasicAppEvent, Utils } from 'Lib/types-util';

type DefaultState = FL.FlushState & TR.UseTrackingRenderer & { store: StoreF2<unknown, unknown> }

export const defaultBehaviour = (
    { reloadOnStart = true }
) => <R extends DefaultState, H, Ext, RootComp extends ComponentElement, P>(u: Utils<R, H, BasicAppEvent<R, H>,
    WithComponent<P, RootComp> & Ext, RootComp
>) => pipe(u
    , AP.defaultBuild, AP.attachStore
    , AP.addReducer(_ => FL.flushReducer(
        _.actions([
            TR.untrackRendererElementsAction(),
            CA.flush
        ])))
    , AP.addReducer(_ => storeReducer('store'))
    , AP.extend(a => ({
        handleMessage: CA.tctx(tctx => CA.ifStart(tctx) && reloadOnStart
            ? a.actionF(reloadInterface)
            : a.ext.defaultMessageHandler)
    }))
)
