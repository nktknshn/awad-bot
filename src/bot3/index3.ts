import { flow, pipe } from "fp-ts/lib/function";
import { application, chatState, defaultRenderScheme, genericRenderComponent } from "Lib/application";
import * as CA from 'Lib/chatactions';
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import { UseTrackingRenderer } from "Lib/components/actions/tracker";
import { withUserMessages } from 'Lib/context';
import { attachStore, handleActionExtension, handleEventExtension, renderExtension, initExtension, withInit, withContextCreator, withProps, renderFuncExtension, reducerExtension, addReducer, withDefaultReducer, withActionReducer, defaultBuild, attachStoreExtensionA, extend, complete} from 'Lib/newapp';
import { ChatActionReducer, composeReducers, defaultReducer, extendDefaultReducer, extendReducerFunction, reducer, reducerToFunction, storeReducer } from 'Lib/reducer';
import { select } from 'Lib/state';
import { storef, StoreF2 } from 'Lib/storeF';
import { buildApp, Defined, GetState } from 'Lib/types-util';
import { TelegrafContext } from "telegraf/typings/context";
import { PhotoSize } from 'telegraf/typings/telegram-types';
import { App } from './app';
import { createLevelTracker, levelDatabase, levelTracker } from './leveltracker';
import { getDispatcher } from './store';
import { flush } from "./util";

type WithStore<K extends keyof any, S> = Record<K, StoreF2<S>>
const add = <T>(arg: T) => async (tctx: TelegrafContext) => arg

export type Bot3StoreState = {
    isVisible: boolean,
    items: (string | PhotoSize)[],
    secondsLeft: number,
    timer: NodeJS.Timeout | undefined,
    stringCandidate: string | undefined,
}

export const store = storef<Bot3StoreState>({
    isVisible: false,
    items: [],
    secondsLeft: 0,
    timer: undefined,
    stringCandidate: undefined,
})

export const contextCreatorBot3 = select(
    ((cs: WithStore<'store', Bot3StoreState>) => ({
        dispatcher: getDispatcher(cs.store),
        ...cs.store.state
    })),
    withUserMessages,
)

const state = chatState([
    FL.withFlush({ deferRender: 0, bufferedInputEnabled: false }),
    TR.withTrackingRenderer(createLevelTracker('./mydb')),
    add({ store })
])

const app = pipe(
    buildApp(App, state),
    flow(defaultBuild, attachStore),
    withContextCreator(contextCreatorBot3),
    withProps({ password: 'a' }),
    withInit(a =>
        a.actions([
            TR.initTrackingRenderer(),
            a.ext.attachStore
        ])
    )
    , addReducer(_ =>
        FL.flushReducer(
            CA.sequence([
                TR.untrackRendererElementsAction(),
                CA.flush
            ])
        ))
    , addReducer(_ => storeReducer('store'))
    , extend(a => ({
        handleMessage: CA.tctx(tctx => CA.ifStart(tctx)
            ? a.actionF(reloadInterface)
            : a.actions([
                CA.applyInputHandler,
                TR.saveToTrackerAction(),
                FL.addUserMessageIfNeeded(),
                CA.applyEffects,
                FL.deferredRender()
            ]))
    }))
    , complete
)

export const createApp = () => application(app.ext)