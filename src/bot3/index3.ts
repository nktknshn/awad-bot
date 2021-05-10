import { flow, pipe } from "fp-ts/lib/function";
import { application, chatState } from "Lib/application";
import * as CA from 'Lib/chatactions';
import { ComponentElement } from "Lib/component";
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import { withUserMessages } from 'Lib/context';
import { defaultBehaviour } from "Lib/defaults";
import * as AP from 'Lib/newapp';
import { WithComponent } from "Lib/newapp";
import { storeReducer } from 'Lib/reducer';
import { select } from 'Lib/state';
import { storef, StoreF2 } from 'Lib/storeF';
import { BuildApp, buildApp, getBuildApp2, GetState, BasicAppEvent, Utils, AppActionsFlatten } from 'Lib/types-util';
import { TelegrafContext } from "telegraf/typings/context";
import { PhotoSize } from 'telegraf/typings/telegram-types';
import { App } from './app';
import { createLevelTracker } from './leveltracker';
import { getDispatcher } from './store';

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
    buildApp(App, state)
    , defaultBehaviour({ reloadOnStart: false })
    , AP.context(contextCreatorBot3)
    , AP.props({ password: 'a' })
    , AP.complete
)

export const createApp = () => application(app.ext)