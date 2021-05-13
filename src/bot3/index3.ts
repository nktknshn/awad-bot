import { pipe } from "fp-ts/lib/function";
import { chatState } from "Lib/chatstate";
import * as FL from "Lib/components/actions/flush";
import * as TR from "Lib/components/actions/tracker";
import { withUserMessages } from 'Lib/context';
import { defaultFlushAction, DefaultState, addDefaultBehaviour, withDefaults, withStore } from "Lib/defaults";
// import { defaultBehaviour } from "Lib/defaults";
import * as AP from 'Lib/newapp';
import { select } from 'Lib/state';
import { storef, StoreF2 } from 'Lib/storeF';
import { ComponentReqs, GetState } from 'Lib/types-util';
import { finishBuild, startBuild } from "Lib/appbuilder";
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
    withDefaults(),
    async () => ({
        store: store(),
    }),
])


export const { createApplication } = pipe(
    startBuild(App, state)
    , addDefaultBehaviour
    , a => withStore(a, { storeKey: 'store' })
    , AP.context(contextCreatorBot3)
    , AP.props({ password: 'a' })
    , finishBuild()
    , AP.withCreateApplication
)