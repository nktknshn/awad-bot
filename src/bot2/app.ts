import { pipe } from "fp-ts/lib/function";
import { map as mapOpt, toUndefined } from "fp-ts/lib/Option";
import { createCardFromWord, isEnglishWord, parseCard } from "../bot/parsing";
import { parseWordId } from "../bot/utils";
import { Comp as Comp, Comp2, Comp3, CompConstructorWithState, Component, ConnectedComp, WithContext } from "../lib/elements";
import { button as _button, buttonsRow, effect, input as _input, message } from "../lib/elements-constructors";
import { combine, req, Selector } from "../lib/state";
import { Getter, parsePath, tryKey } from "../lib/util";
import { AwadContextT } from "./chathandler";
import Settings from "./components/Settings";
import { Trainer } from "./components/trainer";
import WordsPage from "./components/WordsPage";
import PinnedCards from "./connected/PinnedCards";
import { getDispatcher, getIfUserLoaded, getPath, getSettings, getTrainer, getUser } from "./store/selectors";
import { UserEntityState } from "./store/user";
import { AppDispatch } from "./storeToDispatch";

const messages: Record<string, string> = {
    'word_added': '👌 Word added',
    'bad_card': '❌ Bad card',
    'not_found': '❌ Word wasn\'t found',
    'word_removed': '👌 Word removed',
    'not_ready': '❌ The component isn\'t ready yet',
}

export type WithDispatcher = { dispatcher: AppDispatch }

const { input, button } = contexted<WithDispatcher>()

function* AppInput() {
    yield input(({ dispatcher: { onCard, onRedirect } }) => async ({ messageText }, next) => {
        if (!messageText)
            return

        if (isEnglishWord(messageText)) {
            await onCard(createCardFromWord(messageText))
            return
        }

        const card = parseCard(messageText)

        if (card) {
            await onCard(card)
        }
        else if (parseWordId(messageText)) {
            await onRedirect(messageText)
        }
        else
            await onRedirect('main?message=bad_card')
    })
}



const App = Comp(
    req(getDispatcher, getIfUserLoaded, getPath),
    function* ({
        path, userLoaded, dispatcher
    }) {
        const { pathname, query } = parsePath(path)
        const titleMessage = pipe(tryKey('message', query), mapOpt(String), toUndefined)

        if (!userLoaded) {
            yield message('Loading profile...')
            return
        }

        yield PinnedCards({ onUnpin: dispatcher.onTogglePinnedWord })

        if (pathname == 'main') {
            yield Component(AppInput)(dispatcher)
            yield MainMenu({ titleMessage })
        }
        else if (pathname == 'settings') {
            yield Settings({})
            yield button('Back', ({ dispatcher }) => () => dispatcher.onRedirect('main'))
        }
        else if (pathname == 'trainer') {
            yield Trainer({ onRedirect: dispatcher.onRedirect, onUpdated: dispatcher.onUpdatedTrainer })
        }
        else if (pathname == 'words' || pathname == '/words') {
            const wordId = pipe(tryKey('wordId', query), mapOpt(Number), toUndefined)
            yield Component(AppInput)(dispatcher)

            yield WordsPage({ wordId })
        }
        else {
            yield effect(() => dispatcher.onRedirect('main?message=not_ready'))
        }

    }
)

const MainMenu = Comp3(
    req(getDispatcher, getUser),
    ({ user, dispatcher: { onRedirect } }) =>
        function* ({ titleMessage }: { titleMessage?: string }) {

            if (!user)
                return

            yield message([
                titleMessage ? `${messages[titleMessage]}` : ``,
                `Hello, You have ${user.words.length} words in your database.`
            ])

            yield buttonsRow([
                ['My words', 'words'],
                ['Components', 'components'],
                // ['Tags', 'tags'],
                // ['Statistics', 'stats'],
                // ['Random word', 'random'],
                ['Train', 'trainer'],
            ],
                (_, path) => onRedirect(path))

            yield buttonsRow(
                [
                    ['Settings', 'settings'],
                    ['Minimize', 'main'],
                ],
                (_, path) => onRedirect(path)
            )
        }
)

function contexted<Context>() {

    type NthArg<T extends (...args: any) => any, N extends number> = Parameters<T>[N]

    type Z = NthArg<typeof _input, 0>

    const input = function (
        callback: (ctx: Context) => NthArg<typeof _input, 0>
    ) {
        return new WithContext(
            (ctx: Context) => _input(callback(ctx))
        )
    }

    const button =
        (
            text: string,
            callback: ((ctx: Context) => () => Promise<any>)
        ) => new WithContext((ctx: Context) => _button(text, callback(ctx)))

    return {
        input,
        button
    }
}


export default App
