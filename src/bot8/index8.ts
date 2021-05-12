import * as AP from 'Lib/newapp';
import * as TR from "Lib/components/actions/tracker";
import { chatState } from 'Lib/application';
import { myDefaultBehaviour, withDefaults } from 'Lib/defaults';
import { select } from 'Lib/state';
import { connected } from 'Lib/component';
import { storef } from 'Lib/storeF';
import { button, keyboardButton, message } from 'Lib/elements-constructors';
import { KeyboardButtonElement } from 'Lib/elements';
import { pipe } from 'fp-ts/lib/pipeable';
import { buildApp, ComponentTypes, GetChatState, GetState } from 'Lib/types-util';
import { createLevelTracker } from 'bot3/leveltracker';
import { chatstateAction } from 'Lib/reducer';
import { contextSelector } from 'Lib/context';


// export type Bot8StoreState = {
//     a: number
// }

// export const store = () => storef<Bot8StoreState>({ a: 1 })

const state = () => chatState([
    TR.withTrackingRenderer(createLevelTracker('./mydb_bot8')),
    withDefaults({}),
    async () => ({
        // store: store(),
        a: 1
    }),
])

type State = GetChatState<typeof state>
const context = contextSelector<State>()('a', 'error')

export const App = connected(
    context.fromContext,
    function* ({ a, error }) {

        yield message(`error: ${error}`)

        yield message(`Монстр 1 ${a}`)
        yield button('ударить', () => [
            chatstateAction<{ a: number }>(s => ({ ...s, a: a + 1 }))
        ])

        yield message(`Монстр 2`)
        yield button('ударить', () => [
            chatstateAction<{ a: number }>(s => ({ ...s, a: a + 1 }))
        ])

        yield message(`месааг`)

        yield keyboardButton(['Убежать', 'Инвентарь'])

        if(a > 2)
            yield keyboardButton('Кастовать')

        yield keyboardButton('button4')

    }
)

const app = pipe(
    buildApp(App, state)
    , myDefaultBehaviour
    , AP.context(cs => context.fromState(cs))
    , AP.complete
    , AP.withCreateApplication
)

export const createApp = app.ext.createApplication