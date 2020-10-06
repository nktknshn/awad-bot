import { createStore } from "redux";
import { createAction, createReducer, createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { UserEntity } from "../../database/entity/user";
import { WordEntity } from "../../database/entity/word";


export interface TrainerCard {
    correctWord: WordEntity,
    wrongs: WordEntity[],
    answer?: number
}

export interface TrainerState {
    cards: TrainerCard[]
}

const initialState: TrainerState = { cards: [] }

const trainerSlice = createSlice({
    name: 'trainer',
    initialState,
    reducers: {
        updateTrainer(state, action: PayloadAction<TrainerState>) {
            return action.payload
        }
    }
})

export const { updateTrainer } = trainerSlice.actions
export default trainerSlice.reducer