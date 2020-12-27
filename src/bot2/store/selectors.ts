import { RootState } from ".";
import { UserEntity } from "../../database/entity/user";

export const isUserLoaded = (state: RootState) => !!state.user
export const getUser = (state: RootState) => state.user!
export const getUserId = (state: RootState) => getUser(state)?.id
export const getWords = (state: RootState) => getUser(state)?.words