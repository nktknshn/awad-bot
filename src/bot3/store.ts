import { PhotoSize } from "telegraf/typings/telegram-types"
import { mylog } from "../lib/logging"
import { createStoreF, wrap } from "../lib/store2"

export type StoreState = {
    isVisible: boolean,
    items: (string | PhotoSize)[],
    secondsLeft: number,
    timer: NodeJS.Timeout | undefined,
    stringCandidate: string | undefined,
}

export function createBotStoreF() {

    const { store } = createStoreF<StoreState>({
        isVisible: false,
        items: [],
        secondsLeft: 0,
        timer: undefined,
        stringCandidate: undefined
    })

    type Action<S> = (s: S) => S

    const upd = (u: Partial<StoreState>) => (s: StoreState) => ({ ...s, ...u })
    const updF = (
        f: (s: StoreState) => Action<StoreState>
    ) => (s: StoreState) => f

    const onSetSecondsLeft = (secondsLeft: number): Action<StoreState> => (s: StoreState) => {
        return upd({ secondsLeft })(s)
    }

    const updateSeconds = (): Action<StoreState> => (s: StoreState) => {
        if (s.secondsLeft > 0)
            return onSetSecondsLeft(s.secondsLeft - 1)(s)
        else
            return onSetVisible(false)(s)
    }

    const onSetVisible = (isVisible: boolean): Action<StoreState> => (s) => {

        s = upd({ isVisible })(s)

        if (isVisible) {
            const timer = setInterval(() => store.notify(wrap(updateSeconds)()), 1000)
            return upd({
                secondsLeft: 15,
                timer
            })(s)
        }
        else {
            s.timer && clearInterval(s.timer)

            return upd({ timer: undefined })(s)
        }
    }

    const onAddItem = (item: string | PhotoSize[]) => (s: StoreState) => {
        mylog('TRACE onAddItem')
        mylog(item)

        return upd({ items: [...s.items, ...Array.isArray(item) ? item : [item]] })(s)
    }

    const onDeleteItem = (item: string | PhotoSize) => (s: StoreState) => {
        return upd({ items: s.items.filter(_ => _ != item) })(s)
    }

    const setStringCandidate = (c?: string) => (s: StoreState) => upd({ stringCandidate: c })(s)

    return {
        store,
        dispatcher: {
            onSetVisible: wrap(onSetVisible),
            onAddItem: wrap(onAddItem),
            onSetSecondsLeft: wrap(onSetSecondsLeft),
            onDeleteItem: wrap(onDeleteItem),
            setStringCandidate: wrap(setStringCandidate)
        }
    }

}