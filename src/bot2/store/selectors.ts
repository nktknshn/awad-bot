import { UserEntityState } from "./user";

// export const isUserLoaded = (state: RootState) => !!state.user
// export const getUser = (state: RootState) => state.user!
// export const getUserId = (state: RootState) => getUser(state)?.id
// export const getWords = (state: RootState) => getUser(state)?.words

import * as F from 'fp-ts/function'
import { AppSettings } from "./settings";
import { combine } from "../../lib/state";
import { TrainerState } from "./trainer";
import { AwadContextT } from "../chathandler";

// export const getState = ({state}: AwadContext) => state
export const getUser = ({ user }: { 'user': UserEntityState | null }) => ({ user })
export const getpinnedWordsIds = F.flow(getUser, ({ user }) => ({ pinnedWordsIds: user!.pinnedWordsIds }))
export const getSettings = ({ settings }: Record<'settings', AppSettings>) => ({ settings })
export const getUserAndSettings = combine(getpinnedWordsIds, combine(getUser, getSettings))

export const getIfUserLoaded = F.flow(getUser, ({ user }) => ({ userLoaded: !!user }))
export const getPath = ({ path }: { path: String }) => ({ path })
export const getTrainer = ({ trainer }: { trainer: TrainerState }) => ({ trainer })
export function getDispatcher({dispatcher}: AwadContextT) {
    return {
        dispatcher
    }
}