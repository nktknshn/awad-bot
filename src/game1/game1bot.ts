import { pipe } from "fp-ts/lib/pipeable";
import { startBuild } from "Lib/appbuilder";
import { runbot, createLevelTracker } from "Lib/botmain";
import { connected } from "Lib/component";
import { withTrackingRenderer } from "Lib/components/actions/tracker";
import { defaultBehaviour, defaultState } from "Lib/defaults";
import { button, buttonsRow, keyboardButton, messagePart, nextMessage } from "Lib/elements-constructors";
import { CA, A, AP, BU, chatState, message } from 'Lib/lib'
import { finishBuild } from "Lib/newapp";
import { select } from "Lib/state";
import { GetSetState } from "Lib/tree2";


const state = () => chatState([
    defaultState(),
    withTrackingRenderer(createLevelTracker('mydb_bot7')),
    async () => [

    ]
])


const App = connected(
    select(),
    function* (ctx: unknown, props: {}, { getState, setState, lenses }: GetSetState<{
        open?: 'desk' | 'bed' | 'cupboard'
    }>) {

        const { open } = getState({})

        yield message('🚬 <b>5</b>  🔋 <b>80%</b>')
        yield nextMessage()
        yield messagePart('Комната небольшая, темная. Кровать, комод, небольшой сервант, письменный стол. Шторы прикрыты. Слой пыли покрывает глянцевую поверхность советской потрепаной мебели. ')
        yield messagePart('Могу осмотреть:')

        if (open === 'desk') {
            yield buttonsRow(['шкафчик1 ❓', 'шкафчик2 ❓'], () => [])
            yield button('закрыть', () => [setState(lenses('open').set(undefined))])
            yield message('Обычный стол, ничего интересного')
        }

        else if (open === 'cupboard') {
            yield buttonsRow(['дверца', 'шкафчик'], () => [])
            yield button('закрыть', () => [setState(lenses('open').set(undefined))])
            yield message('Вижу водочку')
        }

        else {

            yield button('стол ❓', () => [setState(lenses('open').set('desk'))])
            yield button('сервант ❓', () => [setState(lenses('open').set('cupboard'))])
            yield button('кровать ❓', () => [setState(lenses('open').set('bed'))])
            yield message('Можно обыскать, можно пойти назад')

        }

        yield keyboardButton(['Уйти', 'Инвентарь'])
    }
)


const { createApplication } = pipe(
    startBuild(App, state)
    , defaultBehaviour
    , AP.context(cs => ({}))
    , finishBuild()
    , AP.withCreateApplication
)

runbot({ app: createApplication({}) })