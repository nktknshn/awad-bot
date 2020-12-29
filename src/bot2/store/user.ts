import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit"
import { DeepPartial } from "typeorm"
import { RootState } from "."
import { Card, Meaning } from "../../bot/interfaces"
import { CardUpdate } from "../../bot/parsing"
import { UserEntity } from "../../database/entity/user"
import { WordEntity } from "../../database/entity/word"
import { lastItem, toggleItem } from "../../lib/util"
import { AwadServices } from "../services"
import { getUser } from "./selectors"

// export interface UserState {
//     user?: UserEntity
// }

// (new UserEntity()).

const getUserId = ({ user }: RootState) => user?.id

export interface WordEntityState {
    id: number
    created: Date,
    theword: string,
    tags: string[]
    meanings: Meaning[],
    transcription?: string,
    translations: string[]
}
// (new WordEntity())

export interface UserEntityState {
    id: string,
    created: Date,
    renderedMessagesIds: number[],
    words: WordEntityState[]
    pinnedWordsIds: number[]
}

// const initialState: UserState = {}
const initialState: UserEntityState | undefined = undefined

type API = {
    state: RootState
    extra: AwadServices
}

export const fetchUser = createAsyncThunk<UserEntityState | undefined, number, API>(
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
    UserEntityState | undefined,
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
    UserEntityState | undefined,
    { word: WordEntityState, update: CardUpdate },
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
    UserEntityState | undefined,
    { word: WordEntityState, card: Card },
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
    UserEntityState | undefined,
    WordEntityState,
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
    UserEntityState | undefined,
    { word: WordEntityState, example: string },
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
    initialState: null as UserEntityState | null,
    reducers: {
        updateUser: (state, action: PayloadAction<UserEntityState>) => {
            return action.payload
        },
        togglePinnedWord: (state, { payload }: PayloadAction<number>) => {
            
            if(state === null)
                return state

            return {
                ...state,
                pinnedWordsIds: toggleItem(state?.pinnedWordsIds ?? [], payload)
            }
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

export const { updateUser, togglePinnedWord } = userSlice.actions

export default userSlice.reducer