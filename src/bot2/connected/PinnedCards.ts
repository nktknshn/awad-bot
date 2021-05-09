// import { Selector } from "@reduxjs/toolkit"
import { filter } from "fp-ts/lib/Array"
import { pipe, flow } from "fp-ts/lib/function"
import { button, nextMessage } from "../../lib/elements-constructors"
import { Component, connected, ConnectedComp } from "../../lib/component"
import { Card } from "../components/Card"
import { RootState } from "../store"
import { WordEntityState } from "../store/user"
import { getUser } from "../store/selectors"
import { GetSetState } from "Lib/tree2"
import { select } from "Lib/state"

export const getPinnedCards = flow(getUser, ({ user }) => ({
    pinnedCards: user
        ? pipe(
            user.words,
            filter(word => user.pinnedWordsIds.indexOf(word.id) > -1)
        )
        : []
}))

export default connected(
    select(getPinnedCards),
    function* PinnedCards(
        { pinnedCards },
        { onUnpin }: {
            onUnpin?: (wordId: number) => void
        },
        { getState, setState, lenses }: GetSetState<{ showMenu: boolean }>
    ) {

        const { showMenu } = getState({ showMenu: false })

        if (!pinnedCards.length)
            return

        for (const word of pinnedCards) {
            yield Card({ word })
            yield nextMessage()
        }

        if (onUnpin)

            if (!showMenu)
                yield button('Unpin',
                    () => setState(lenses('showMenu').set(true))
                )
            else {
                for (const item of pinnedCards) {
                    yield button(`Unpin ${item.theword}`, async () => {
                        return onUnpin(item.id)
                    })
                }

                yield button('Cancel', async () => {
                    setState(lenses('showMenu').set(false))
                })
            }

        yield nextMessage()

    }
)

// export default connected(PinnedCards)