import { pipe } from "fp-ts/lib/function";
import { application, chatState } from "Lib/application";
import * as FL from "Lib/components/actions/flush";
import * as TR from "Lib/components/actions/tracker";
import { withUserMessages } from 'Lib/context';
import { defaultFlushAction, DefaultState, myDefaultBehaviour, withDefaults } from "Lib/defaults";
// import { defaultBehaviour } from "Lib/defaults";
import * as AP from 'Lib/newapp';
import { select } from 'Lib/state';
import { storef, StoreF2 } from 'Lib/storeF';
import { buildApp, GetState } from 'Lib/types-util';
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

export const store = () =>
    storef<Bot3StoreState>({
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

const tracker = createLevelTracker('./mydb')

const state = () => chatState([
    TR.withTrackingRenderer(tracker),
    withDefaults({
        reloadOnStart: true,
        deferRender: 0,
        bufferedInputEnabled: false
    }),
    async () => ({
        store: store(),
    }),
])

const app = pipe(
    buildApp(App, state)
    , myDefaultBehaviour
    , AP.context(contextCreatorBot3)
    , AP.props({ password: 'a' })
    , AP.complete
    , AP.withCreateApplication
)

export const createApp = app.ext.createApplication