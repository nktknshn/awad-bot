import * as F from 'fp-ts/function';
import { combine } from "../../lib/state";
import { AwadContextT } from "../chathandler";
import { AppSettings } from "./settings";
import { TrainerState } from "./trainer";
import { UserEntityState } from "./user";


// export const getState = ({state}: AwadContext) => state

// export const getUser = Lens.fromProp<{ 'user': UserEntityState | null }>()('user').get

export const getUser = ({ user }: { 'user': UserEntityState | null }) => ({ user })
export const getPinnedWordsIds = F.flow(getUser, ({ user }) => ({ pinnedWordsIds: user!.pinnedWordsIds }))
export const getSettings = ({ settings }: Record<'settings', AppSettings>) => ({ settings })
export const getUserAndSettings = combine(getPinnedWordsIds, combine(getUser, getSettings))

export const getIfUserLoaded = F.flow(getUser, ({ user }) => ({ userLoaded: !!user }))
export const getPath = ({ path }: { path: string }) => ({ path })
export const getTrainer = ({ trainer }: { trainer: TrainerState }) => ({ trainer })
export const getDispatcher = ({dispatcher}: {dispatcher: AwadContextT['dispatcher']}) => ({dispatcher})


