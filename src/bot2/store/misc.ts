import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { toggleItem } from "../../lib/util"


export interface MiscState {
    selectedIds: number[]
}

const initialState: MiscState = { selectedIds: [] }

const miscSlice = createSlice({
    name: 'misc',
    initialState,
    reducers: {
        toggleIndex(state, action: PayloadAction<number>) {
            return {
                ...state,
                selectedIds: toggleItem(state.selectedIds, action.payload)
            }
        }
    }
})

export const { toggleIndex } = miscSlice.actions

export default miscSlice.reducer