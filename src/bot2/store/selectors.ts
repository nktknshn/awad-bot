import { RootState } from ".";
import { UserEntity } from "../../database/entity/user";

// export const isUserLoaded = (state: RootState) => !!state.user
// export const getUser = (state: RootState) => state.user!
// export const getUserId = (state: RootState) => getUser(state)?.id
// export const getWords = (state: RootState) => getUser(state)?.words



export const getUser: Selector<RootState> = ({ user }) => ({ user })
export const getSettings: Selector<RootState> = ({ settings }: RootState) => ({ settings })
export const getUserAndSettings = combine(getUser, getSettings)

export type Selector<S, R = any> = (state: S) => R

export function combine<S, R1, R2>(
    sel1: Selector<S, R1>,
    sel2: Selector<S, R2>,
): Selector<S, R1 & R2> {
    return function(state) {
        return {...sel1(state), ... sel2(state)}
    }
}
