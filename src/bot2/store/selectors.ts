import { UserEntity } from "../../database/entity/user";
import { UserEntityState } from "./user";

// export const isUserLoaded = (state: RootState) => !!state.user
// export const getUser = (state: RootState) => state.user!
// export const getUserId = (state: RootState) => getUser(state)?.id
// export const getWords = (state: RootState) => getUser(state)?.words

import * as F from 'fp-ts/function'
import { AppSettings } from "./settings";

export function combine<S1, S2, R1, R2>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
): Selector<S1 & S2, R1 & R2> {
    return function (state) {
        return { ...sel1(state), ...sel2(state) }
    }
}

export const getUser = function ({ user }: Record<'user', UserEntityState | null>) {
    return ({ user })
}

export const getpinnedWordsIds = F.flow(getUser, ({ user }) => ({ pinnedWordsIds: user!.pinnedWordsIds }))

export const getSettings = ({ settings }: Record<'settings', AppSettings>) => ({ settings })
export const getUserAndSettings = combine(getpinnedWordsIds, combine(getUser, getSettings))

export type Selector<S, R> = (state: S) => R
