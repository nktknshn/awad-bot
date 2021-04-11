import { flow, identity, pipe } from "fp-ts/lib/function";
import * as O from 'fp-ts/lib/Option';
import { map as mapOpt, toUndefined } from "fp-ts/lib/Option";
import { connected1 as connected1, connected2, WithContext } from "../lib/elements";
import { button as _button, buttonsRow, effect, input as _input, message } from "../lib/elements-constructors";
import { select } from "../lib/state";
import { parsePath, tryKey } from "../lib/util";
import Settings from "./components/Settings";
import { Trainer } from "./components/trainer";
import WordsPage from "./components/WordsPage";
import PinnedCards from "./connected/PinnedCards";
import { createCardFromWordOpt, inputGroup, inputOpt, messageText, parseCardOpt, parseWordIdOpt } from "./input";
import { getDispatcher, getIfUserLoaded, getPath, getUser } from "./store/selectors";
import { AppDispatch } from "./storeToDispatch";

const messages: Record<string, string> = {
    'word_added': '👌 Word added',
    'bad_card': '❌ Bad card',
    'not_found': '❌ Word wasn\'t found',
    'word_removed': '👌 Word removed',
    'not_ready': '❌ The component isn\'t ready yet',
}

export type WithDispatcher = { dispatcher: AppDispatch }

const { button } = contexted<WithDispatcher>()


const AppInput = connected1(
    select(getDispatcher),
    function* ({ dispatcher: { onCard, onRedirect } }) {
        yield inputGroup([
            _ =>
                flow(O.chain(messageText),
                    O.chain(createCardFromWordOpt),
                    O.map(onCard)),
            _ =>
                flow(
                    O.chain(messageText),
                    O.chain(parseCardOpt),
                    O.map(onCard)
                ),
            _ =>
                flow(
                    O.chain(messageText),
                    O.chainFirst(parseWordIdOpt),
                    O.map(onRedirect)
                ),
            _ => flow(identity, O.map(() => onRedirect('main?message=bad_card')))
        ])

    }
)


const App = connected1(
    select(getDispatcher, getIfUserLoaded, getPath),
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
            yield AppInput({})
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
            yield AppInput({})
            yield WordsPage({ wordId })
        }
        else {
            yield effect(() => dispatcher.onRedirect('main?message=not_ready'))
        }

    }
)

const MainMenu = connected2(
    select(getDispatcher, getUser),
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
