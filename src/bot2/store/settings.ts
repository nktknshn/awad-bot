import { createSlice, PayloadAction } from "@reduxjs/toolkit"

export type AppSettings = {
    columns: 1 | 2
}

const pathSlice = createSlice({
    name: 'settings',
    initialState: {
        columns: 1 as 1 | 2
    },
    reducers: {
        setColumns(state, action: PayloadAction<1 | 2>) {
            return { ...state, columns: action.payload }
        },
        updateSettings(state, action: PayloadAction<Partial<AppSettings>>) {
            return { ...state, ...action.payload }
        }
    }
})

export const { setColumns, updateSettings } = pathSlice.actions

export default pathSlice.reducer