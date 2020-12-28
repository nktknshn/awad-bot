import { Selector } from "@reduxjs/toolkit"
import { filter } from "fp-ts/lib/Array"
import { pipe } from "fp-ts/lib/function"
import { button, nextMessage } from "../../lib/constructors"
import { Component, ConnectedComp, GetSetState } from "../../lib/types"
import { Card } from "../components/Card"
import { RootState } from "../store"
import { WordEntityState } from "../store/user"

export const getPinnedCards: Selector<RootState, { pinnedCards: WordEntityState[] }> = ({ user }) => ({
    pinnedCards: user
        ? pipe(
            user.words,
            filter(word => user.pinnedWordsIds.indexOf(word.id) > -1)
        )
        : []
})

export function* PinnedCards(
    { pinnedCards, onUnpin }: {
        pinnedCards: WordEntityState[],
        onUnpin: (wordId: number) => Promise<void>
    },
    { getState, setState }: GetSetState<{ showMenu: boolean }>
) {

    const { showMenu } = getState({ showMenu: false })

    if (!pinnedCards.length)
        return

    for (const word of pinnedCards) {
        yield Component(Card)({ word })
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