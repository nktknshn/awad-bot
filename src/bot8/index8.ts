import { createLevelTracker } from 'bot3/leveltracker';
import { pipe } from 'fp-ts/lib/pipeable';
import { AppBuilder, finishBuild, startBuild } from "Lib/appbuilder";
import { chatState, empty } from 'Lib/chatstate';
import { connected } from 'Lib/component';
import { withTimer, timerState, WithTimerState } from 'Lib/components/actions/rendertimer';
import * as TR from "Lib/components/actions/tracker";
import { contextSelector } from 'Lib/context';
import { addDefaultBehaviour, DefaultRender, DefaultState, defaultState } from 'Lib/defaults';
import { buttonsRow, keyboardButton, message } from 'Lib/elements-constructors';
import { action, caseText, inputHandler, on } from 'Lib/input';
import * as AP from 'Lib/newapp';
import { chatStateAction } from 'Lib/reducer';
import { select } from 'Lib/state';
import { GetChatState } from 'Lib/types-util';
import * as CA from 'Lib/chatactions';
import { flow } from 'fp-ts/lib/function';


const KeyboardMenu = connected(
    select(),
    function* <R>({ }, props: {
        buttons: string[][],
        actions: (btnText: string) => R
    }) {
        yield message(`Вы наносите удар`)

        yield inputHandler([
            on(caseText, action(({ messageText }) => props.actions(messageText)))
        ])

        for (const btnRow of props.buttons) {
            yield keyboardButton(btnRow)
        }
    }
)

export const context = contextSelector<GetChatState<typeof state>>()('error', 'gameMessage', 'a', 'b')

export const App = connected(
    context.fromContext,
    function* ({ a, b, error, gameMessage },
        //  { ss }: { ss: number }, 
        // XXX
    ) {

        yield message(`gameMessage: ${gameMessage}`)

        yield message(`Монстр 1 = ${a}, Монстр 2 = ${b}`)
        yield buttonsRow(['ударить 1', 'ударить 2'], (idx,) => [
            chatStateAction<{ a: number }>(s => ({ ...s, a: a + 1 })),
            chatStateAction<{ b: number }>(s => ({ ...s, b: b + 1 })),
        ][idx])

        // yield message(`Монстр 2`)
        // yield button('ударить', () => [
        //     chatStateAction<{ a: number }>(s => ({ ...s, a: a + 1 }))
        // ])

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
    b: 0,
    gameMessage: empty<string>()
})

const state = () => chatState([
    TR.withTrackingRenderer(createLevelTracker('./mydb_bot7')),
    defaultState({}),
    bot8state,
    timerState
])

const app = pipe(
    startBuild(App, state)
    , withTimer
    , addDefaultBehaviour
    , AP.context(context.fromState)
    , finishBuild()
)

export const { createApplication: createApp } = AP.withCreateApplication(app)