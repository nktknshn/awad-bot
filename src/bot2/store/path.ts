import { createSlice, PayloadAction } from "@reduxjs/toolkit"

type PathState = string | null

const pathSlice = createSlice({
    name: 'path',
    initialState: '/words',
    reducers: {
        redirect(state, action: PayloadAction<string>) {
            return action.payload
        }
    }
})

export const { redirect } = pathSlice.actions

export default pathSlice.reducer