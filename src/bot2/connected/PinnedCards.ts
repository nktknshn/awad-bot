// import { Selector } from "@reduxjs/toolkit"
import { filter } from "fp-ts/lib/Array"
import { pipe, flow } from "fp-ts/lib/function"
import { button, nextMessage } from "../../lib/elements-constructors"
import { GetSetState } from "../../lib/elements"
import { Component, ConnectedComp } from "../../lib/component"
import { Card } from "../components/Card"
import { RootState } from "../store"
import { WordEntityState } from "../store/user"
import { getUser } from "../store/selectors"

export const getPinnedCards = flow(getUser, ({ user }) => ({
    pinnedCards: user
        ? pipe(
            user.words,
            filter(word => user.pinnedWordsIds.indexOf(word.id) > -1)
        )
        : []
}))

export function* PinnedCards(
    { pinnedCards, onUnpin }: {
        pinnedCards: WordEntityState[],
        onUnpin: (wordId: number) => void
    },
    { getState, setState }: GetSetState<{ showMenu: boolean }>
) {

    const { showMenu } = getState({ showMenu: false })

    if (!pinnedCards.length)
        return

    for (const word of pinnedCards) {
        yield Card({ word })
        yield nextMessage()
    }

    if (!showMenu)
        yield button('Unpin', async () => {
            setState({ showMenu: true })
        })
    else {
        for (const item of pinnedCards) {
            yield button(`Unpin ${item.theword}`, async () => {
                return onUnpin(item.id)
                // .then(() => setState({ showMenu: false }))
            })

        }

        yield button('Cancel', async () => {
            setState({ showMenu: false })
        })
    }

    yield nextMessage()

}

export default ConnectedComp(PinnedCards, getPinnedCards)