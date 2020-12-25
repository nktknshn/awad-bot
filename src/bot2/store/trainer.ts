import { createStore } from "redux";
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { WordEntityState } from "./user";


export interface TrainerCard {
    correctWord: WordEntityState,
    wrongs: WordEntityState[],
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