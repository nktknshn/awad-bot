import { pipe } from "fp-ts/lib/function";
import { map as mapOpt, toUndefined } from "fp-ts/lib/Option";
import { connected1 as connected1, connected2 } from "../lib/component";
import { button, buttonsRow, effect, message } from "../lib/elements-constructors";
import { action, inputHandler, on, otherwise } from "../lib/input";
import { select } from "../lib/state";
import { addRenderedUserMessage } from "../lib/usermessage";
import { parsePath, tryKey } from "../lib/util";
import Settings from "./components/Settings";
import { Trainer } from "./components/trainer";
import WordsPage from "./components/WordsPage";
import PinnedCards from "./connected/PinnedCards";
import { caseCard, caseEnglishWord, caseIfWordId } from "./input";
import { getDispatcher, getIfUserLoaded, getPath, getUser } from "./store/selectors";
import { WithDispatcher } from "./storeToDispatch";

const messages: Record<string, string> = {
    'word_added': '👌 Word added',
    'bad_card': '❌ Bad card',
    'not_found': '❌ Word wasn\'t found',
    'word_removed': '👌 Word removed',
    'not_ready': '❌ The component isn\'t ready yet',
}


const AppInput = ({ dispatcher: { onCard, onRedirect } }: WithDispatcher) =>
    inputHandler([
        on(caseEnglishWord, action((a) => [onCard(a.example)])),
        on(caseCard, action((a) => [onCard(a.card)])),
        on(caseIfWordId, action(a => [onRedirect(a.messageText)])),
        on(otherwise, (action((a) => [onRedirect('main?message=bad_card')]))),
    ])

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
            yield AppInput({ dispatcher })
            yield MainMenu({ titleMessage })
        }
        else if (pathname == 'settings') {
            yield Settings({})
            yield button('Back', () => dispatcher.onRedirect('main'))
        }
        else if (pathname == 'trainer') {
            yield Trainer({ onRedirect: dispatcher.onRedirect, onUpdated: dispatcher.onUpdatedTrainer })
        }
        else if (pathname == 'words' || pathname == '/words') {
            const wordId = pipe(tryKey('wordId', query), mapOpt(Number), toUndefined)
            yield AppInput({ dispatcher })
            yield WordsPage({ wordId })
        }
        else {
            yield message('redirecting')
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


export default App
