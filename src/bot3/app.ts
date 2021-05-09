import { getDispatcher } from 'bot3/store';
import { Bot3StoreState } from 'bot3/index3';
import * as A from 'fp-ts/lib/Array';
import * as F from 'fp-ts/lib/function';
import { pipe } from "fp-ts/lib/pipeable";
import { connected } from "Lib/component";
import { button, message } from "Lib/elements-constructors";
import { action, casePhoto, caseText, ifTrue, inputHandler, on } from "Lib/input";
import { mylog } from 'Lib/logging';
import { GetSetState } from 'Lib/tree2';
import { UserMessageElement } from 'Lib/usermessage';
import { PhotoSize } from "telegraf/typings/telegram-types";
import { photos } from './mediagroup';
import { append, deferRender, flush } from './util';

export const casePassword =
    (password: string) => on(caseText, ifTrue(({ messageText }) => messageText == password))

type AppContext = Bot3StoreState & {
    dispatcher: ReturnType<typeof getDispatcher>,
    error?: string
}

const VisibleSecrets = connected(
    ({ items, dispatcher, secondsLeft }: AppContext) => ({ items, dispatcher, secondsLeft }),
    function* (
        { items, secondsLeft, dispatcher: { onDeleteItem, onSetVisible, onSetSecondsLeft } }
    ) {
        mylog(`TRACE ${items}`)

        const strings = pipe(
            items,
            A.partition((_): _ is string => typeof _ === 'string'),
            ({ right }) => right
        )

        const phots = pipe(
            items,
            A.partition((_): _ is PhotoSize => typeof _ !== 'string'),
            ({ right }) => right
        )

        if (phots.length > 0)
            yield photos(phots.map(_ => _.file_id))

        for (const item of strings) {
            yield message(item)
            yield button('Delete', () => onDeleteItem(item))
        }

        yield message("Secrets!")
        yield button(`Hide`, () => onSetVisible(false))
        yield button([`More time (${secondsLeft} secs)`, 'more'], () => {
            mylog(`TRACE More time clicked ${secondsLeft} -> onSetSecondsLeft(${secondsLeft + 30})`)
            return onSetSecondsLeft(secondsLeft + 30)
        })
    }
)

export const App = connected(
    ({ isVisible, dispatcher }: AppContext) => ({ isVisible, dispatcher }),
    function* (
        { isVisible, dispatcher: { onSetVisible, onAddItem } },
        { password }: { password: string },
        { getState, setState, lenses }: GetSetState<{
            photoCandidates: PhotoSize[],
            userMessages: number[],
            stringCandidate?: string
        }>
    ) {
        mylog('App');

        const { photoCandidates, stringCandidate, userMessages } = getState({
            photoCandidates: [],
            userMessages: []
        })

        if (isVisible) {
            yield VisibleSecrets({})
            return
        }

        const addPhotoCandidate = (photo: PhotoSize[]) =>
            setState(lenses('photoCandidates').modify(append(photo[0])))

        const addUserMessage = (messageId: number) =>
            setState(lenses('userMessages').modify(append(messageId)))

        const resetPhotos = setState(
            F.flow(
                lenses('photoCandidates').set([]),
                lenses('userMessages').set([])
            ))

        const resetUserMessages = setState(lenses('userMessages').set([]))

        yield inputHandler([
            on(casePassword(password), action(() => [
                onSetVisible(true)
            ])),
            on(caseText, action(a => [
                addUserMessage(a.messageId),
                setState(lenses('stringCandidate').set(a.messageText))
            ])),
            on(casePhoto, action(({ photo, messageId }) => [
                addUserMessage(messageId),
                addPhotoCandidate(photo),
                deferRender(300)
            ]))
        ])

        if (stringCandidate) {
            const reset = [
                resetUserMessages,
                setState(lenses('stringCandidate').set(undefined))
            ]
            const addItem = [onAddItem(stringCandidate), reset]
            const rejectItem = reset

            if (!isVisible) {

                for (const m of userMessages) {
                    yield new UserMessageElement(m)
                }

                yield message(`Add?`)
                yield button(`Yes`, () => addItem)
                yield button(`No`, () => rejectItem)
            }
            return
        }
        else if (photoCandidates.length) {
            const reset = [
                resetUserMessages,
                resetPhotos,
                deferRender(0)
            ]

            const addItem = [
                onAddItem(photoCandidates),
                reset,
            ]

            if (!isVisible) {

                for (const m of userMessages) {
                    yield new UserMessageElement(m)
                }

                yield message(`Add ${photoCandidates.length} photos?`)
                yield button(`Yes`, () => addItem)
                yield button(`No`, () => reset)

            }
            return
        }

        yield message("hi")
        yield button('flush', flush)
    }
)
