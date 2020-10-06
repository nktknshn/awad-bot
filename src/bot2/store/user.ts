import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit"
import { DeepPartial } from "typeorm"
import { RootState } from "."
import { Card } from "../../bot/interfaces"
import { CardUpdate } from "../../bot/parsing"
import { UserEntity } from "../../database/entity/user"
import { WordEntity } from "../../database/entity/word"
import { lastItem } from "../../lib/util"
import { Services } from "../services"
import { getUser, getUserId } from "./selectors"

// export interface UserState {
//     user?: UserEntity
// }

// const initialState: UserState = {}
const initialState: UserEntity | undefined = undefined

type API = {
    state: RootState
    extra: Services
}

export const fetchUser = createAsyncThunk<UserEntity | undefined, number, API>(
    'user/fetch',
    async (chatId: number, { extra: services, getState }) => {
        const user = await services.getUser(chatId)
        return user
    }
)

// export const refetchUser = createAsyncThunk<UserEntity | undefined, void, {
//     state: RootState
//     extra: Services
// }>(
//     'user/refetch',
//     async (_, { getState, extra: services }) => {
//         const userId = getUser(getState())?.id
//         if (userId)
//             return await services.getUser(parseInt(userId))
//     }
// )

export const addWord = createAsyncThunk<
    UserEntity | undefined,
    Card,
    API
>(
    'user/addWord',
    async (card, { getState, extra: services, rejectWithValue }) => {
        const userId = getUserId(getState())

        if (!userId)
            return rejectWithValue('empty user')

        const wordEntity = new WordEntity()

        wordEntity.theword = card.word
        wordEntity.tags = card.tags
        wordEntity.meanings = card.meanings
        wordEntity.transcription = card.transcription
        wordEntity.userId = userId

        await services.words.save(wordEntity)
        return await services.getUser(parseInt(userId))
    }
)


export const updateWord = createAsyncThunk<
    UserEntity | undefined,
    { word: WordEntity, update: CardUpdate },
    API
>(
    'user/updateWord',
    async ({ word, update }, { getState, extra: services, rejectWithValue }) => {
        const userId = getUserId(getState())

        if (!userId)
            return rejectWithValue('empty user')

        await services.updateWord(word, update)
        return await services.getUser(parseInt(userId))
    })


export const saveWord = createAsyncThunk<
    UserEntity | undefined,
    { word: WordEntity, card: Card },
    API
>(
    'user/saveWord',
    async ({ word, card }, { getState, extra: services, rejectWithValue }) => {
        const userId = getUserId(getState())
        if (!userId)
            return rejectWithValue('empty user')
        const wordEntity = new WordEntity()

        wordEntity.id = word.id
        wordEntity.theword = card.word
        wordEntity.tags = card.tags
        wordEntity.meanings = card.meanings
        wordEntity.transcription = card.transcription
        wordEntity.userId = userId

        const newWord = await services.words.save(wordEntity)
        return await services.getUser(parseInt(userId))
    }
)

export const deleteWord = createAsyncThunk<
    UserEntity | undefined,
    WordEntity,
    API
>(
    'user/deleteWord',
    async (word, { getState, extra: services, rejectWithValue }) => {
        const userId = getUserId(getState())
        if (!userId)
            return rejectWithValue('empty user')
        await services.words.delete(word.id)
        return await services.getUser(parseInt(userId))

    }
)

export const addExample = createAsyncThunk<
    UserEntity | undefined,
    { word: WordEntity, example: string },
    API
>(
    'user/addExample',
    async ({ word, example }, { getState, extra: services, rejectWithValue }) => {
        const userId = getUserId(getState())
        if (!userId)
            return rejectWithValue('empty user')

        const lastMeaning = lastItem(word.meanings)

        if (!lastMeaning)
            return rejectWithValue('No meanings!')

        const changedWord: DeepPartial<WordEntity> = {
            ...word,
            meanings:
                [
                    ...word.meanings.slice(0, word.meanings.length - 1),
                    {
                        ...lastMeaning,
                        examples: [...lastMeaning.examples, example]
                    }
                ]
        }

        await services.words.save(changedWord)
        return await services.getUser(parseInt(userId))
    }
)

const userSlice = createSlice({
    name: 'user',
    initialState: null as UserEntity | null,
    reducers: {
        updateUser: (state, action: PayloadAction<UserEntity>) => {
            return action.payload
        }
    },
    extraReducers: builder => {
        builder.addCase(
            addWord.fulfilled, (state, { payload }) => {
                return payload
            }
        )
        builder.addCase(
            fetchUser.fulfilled, (state, { payload }) => {
                return payload
            }
        )
        builder.addCase(
            updateWord.fulfilled, (state, { payload }) => {
                return payload
            }
        )
        builder.addCase(
            saveWord.fulfilled, (state, { payload }) => {
                return payload
            }
        )
        builder.addCase(
            deleteWord.fulfilled, (state, { payload }) => {
                return payload
            }
        )
        builder.addCase(
            addExample.fulfilled, (state, { payload }) => {
                return payload
            }
        )
    }

})

export const { updateUser } = userSlice.actions

export default userSlice.reducer