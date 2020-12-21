import { TrainerCard } from "../../bot/components/trainer"
import { UserEntity } from "../../database/entity/user"

export type OnUpdated<T> = (state: T) => Promise<void>

export interface MyStore<T> {
    update(updates: Partial<T>): Promise<void>
    subscribe(onUpdated: OnUpdated<T>): void
}

export function createStore<T>(initialState: T): MyStore<T> {

    let state = initialState
    let subscribers: OnUpdated<T>[]

    return {
        update: async updates => {
            state = { ...state, ...updates }
            for (const subscriber of subscribers) {
                await subscriber(state)
            }
        },
        subscribe: onUpdate => {
            subscribers.push(onUpdate)
        }
    }
}

interface Reducer<Req, Ret> {
    (state: Req): Partial<Req> & Ret
}


namespace Path {
    export interface PathState {
        path: string
    }

}

namespace Settings {
    export interface AppSettings {
        columns: 1 | 2
    }
}

namespace Trainer {
    export interface TrainerState {
        cards: TrainerCard[]
    }
}

namespace User {
    export interface UserState {
        user?: UserEntity
    }
}


// type State = State1 & State2 & State3




// const settingsReducers: Record<string, Reducer<infer Req, infer Ret>> = {

// }