import { PhotoSize } from "telegraf/typings/telegram-types"
import { mylog } from "../lib/logging"
import { createStoreF, StoreAction, storeAction, storef, StoreF2 } from "../lib/storeF"

export type Bot3StoreState = {
    isVisible: boolean,
    items: (string | PhotoSize)[],
    secondsLeft: number,
    timer: NodeJS.Timeout | undefined,
    stringCandidate: string | undefined,
}

// const store = storef<Bot3StoreState>({
//     isVisible: false,
//     items: [],
//     secondsLeft: 0,
//     timer: undefined,
//     stringCandidate: undefined
// })

type ActionStoreState = (s: Bot3StoreState) => Bot3StoreState

const upd = (u: Partial<Bot3StoreState>) => (s: Bot3StoreState) => ({ ...s, ...u })
const updF = (
    f: (s: Bot3StoreState) => ActionStoreState
) => (s: Bot3StoreState) => f

export const getDispatcher = (store: StoreF2<Bot3StoreState>) => {

    const onSetSecondsLeft = (secondsLeft: number): ActionStoreState => (s: Bot3StoreState) => {
        return upd({ secondsLeft })(s)
    }
    
    const updateSeconds = (): ActionStoreState => (s: Bot3StoreState) => {
        if (s.secondsLeft > 0)
            return onSetSecondsLeft(s.secondsLeft - 1)(s)
        else
            return onSetVisible(false)(s)
    }
    
    const onSetVisible = (isVisible: boolean): ActionStoreState => (s) => {
    
        s = upd({ isVisible })(s)
    
        if (isVisible) {
            
            const timer = setInterval(() => store.dispatch(storeAction(updateSeconds)()), 1000)
    
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
    
    const onAddItem = (item: string | PhotoSize[]) => (s: Bot3StoreState) => {
        return upd({ items: [...s.items, ...Array.isArray(item) ? item : [item]] })(s)
    }
    
    const onDeleteItem = (item: string | PhotoSize) => (s: Bot3StoreState) => {
        return upd({ items: s.items.filter(_ => _ != item) })(s)
    }
    
    const setStringCandidate = (c?: string) => (s: Bot3StoreState) => upd({ stringCandidate: c })(s)
    
    return {
        onSetVisible: storeAction(onSetVisible),
        onAddItem: storeAction(onAddItem),
        onSetSecondsLeft: storeAction(onSetSecondsLeft),
        onDeleteItem: storeAction(onDeleteItem),
        setStringCandidate: storeAction(setStringCandidate)
    }
}

// export const bot3Store = {
//     store,
//     dispatcher: {
//         onSetVisible: storeAction(onSetVisible),
//         onAddItem: storeAction(onAddItem),
//         onSetSecondsLeft: storeAction(onSetSecondsLeft),
//         onDeleteItem: storeAction(onDeleteItem),
//         setStringCandidate: storeAction(setStringCandidate)
//     }
// }
