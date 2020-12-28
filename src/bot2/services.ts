import { TelegrafContext } from "telegraf/typings/context"
import { Connection } from "typeorm"
import { CardUpdate } from "../bot/parsing"
import { UserEntity, UserRepository } from "../database/entity/user"
import { WordEntity } from "../database/entity/word"
import { UserEntityState, WordEntityState } from "./store/user"

export type Services = ReturnType<typeof getServices>


function userEntityToState(user: UserEntity): UserEntityState {
    return {
        id: user.id,
        created: user.created,
        renderedMessagesIds: user.renderedMessagesIds,
        words: (user.words ?? []).map(wordEntityToState),
        pinnedWordsIds: []
    }
}

function wordEntityToState(word: WordEntity): WordEntityState {
    return {
        id: word.id,
        created: word.created,
        meanings: word.meanings,
        tags: word.tags,
        theword: word.theword,
        transcription: word.transcription
    }
}

export function getServices(connection: Connection) {
    const users = connection.getCustomRepository(UserRepository)
    const words = connection.getRepository(WordEntity)

    return {
        users,
        words,
        async getUser(chatId: number): Promise<UserEntityState | undefined> {
            let user = await users.findOne(chatId)

            if (user)
                return userEntityToState(user)
        },
        async createUser(userDto: { id: number }): Promise<UserEntityState> {
            let user = new UserEntity()
            user.id = String(userDto.id)
            user = await users.save(user)
            return userEntityToState(user)
        },
        async updateWord(word: WordEntityState, update: CardUpdate & {}) {
            await words.update(word.id, {
                meanings: [...word.meanings, ...(update.meanings ?? [])],
                tags: [...word.tags, ...(update.tags ?? [])],
                theword: update.word ?? word.theword
            })
        }
    }
}

export function dtoFromCtx(ctx: TelegrafContext, message_id?: number) {
    return {
        id: ctx.chat?.id!,
    }
}