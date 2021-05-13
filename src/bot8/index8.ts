import { createLevelTracker } from 'bot3/leveltracker';
import { pipe } from 'fp-ts/lib/pipeable';
import { chatState, empty, stateSelector } from 'Lib/chatstate';
import { connected } from 'Lib/component';
import * as TR from "Lib/components/actions/tracker";
import { myDefaultBehaviour, withDefaults } from 'Lib/defaults';
import { button, keyboardButton, message } from 'Lib/elements-constructors';
import { action, caseText, inputHandler, on } from 'Lib/input';
import * as AP from 'Lib/newapp';
import * as CA from 'Lib/chatactions';

import { chatStateAction } from 'Lib/reducer';
import { select } from 'Lib/state';
import { buildApp, GetChatState } from 'Lib/types-util';
import { contextSelector } from 'Lib/context';
import { renderTimerState, renderWithTimer } from 'Lib/components/actions/rendertimer';

const KeyboardMenu = connected(
    select(),
    function* <R>({ }, props: {
        buttons: string[][],
        actions: (btnText: string) => R
    }) {
        yield message(`для клавы`)

        yield inputHandler([
            on(caseText, action(({ messageText }) => props.actions(messageText)))
        ])

        for (const btnRow of props.buttons) {
            yield keyboardButton(btnRow)
        }
    }
)

export const context = contextSelector<GetChatState<typeof state>>()('error', 'gameMessage', 'a')

export const App = connected(
    context.fromContext,
    function* ({ a, error, gameMessage }) {

        yield message(`gameMessage: ${gameMessage}`)

        yield message(`Монстр 1 ${a}`)
        yield button('ударить', () => [
            chatStateAction<{ a: number }>(s => ({ ...s, a: a + 1 }))
        ])

        yield message(`Монстр 2`)
        yield button('ударить', () => [
            chatStateAction<{ a: number }>(s => ({ ...s, a: a + 1 }))
        ])

        yield KeyboardMenu({
            buttons: [
                ['Убежать', 'Инвентарь'],
                ['Кастовать'],
                ['Кастовать aa']
            ],
            actions: (btn) =>
                chatStateAction<{ gameMessage?: string }>(s => ({ ...s, gameMessage: btn }))
        })

    }
)

export const bot8state = async () => ({
    a: 0,
    gameMessage: empty<string>()
})

const state = () => chatState([
    TR.withTrackingRenderer(createLevelTracker('./mydb_bot8')),
    withDefaults({}),
    bot8state,
    renderTimerState
])

const { createApplication } = pipe(
    buildApp(App, state)
    , renderWithTimer
    , a => myDefaultBehaviour(a, {
        render: a.ext.renderWithTimer
    })
    , AP.context(context.fromState)
    , AP.complete
    , AP.withCreateApplication
)

export const createApp = createApplication