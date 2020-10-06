import { TelegrafContext } from "telegraf/typings/context"
import { Connection } from "typeorm"
import { CardUpdate } from "../bot/parsing"
import { UserEntity, UserRepository } from "../database/entity/user"
import { WordEntity } from "../database/entity/word"

export type Services = ReturnType<typeof getServices>

export function getServices(connection: Connection) {
    const users = connection.getCustomRepository(UserRepository)
    const words = connection.getRepository(WordEntity)

    return {
        users,
        words,
        async getUser(chatId: number) {
            let user = await users.findOne(chatId)
            return user
        },
        async createUser(userDto: { id: number }) {
            let user = new UserEntity()
            user.id = String(userDto.id)
            user = await users.save(user)
            return user
        },
        async updateWord(word: WordEntity, update: CardUpdate & {}) {
            await words.update(word.id, {
                meanings: [...word.meanings, ...update.meanings],
                tags: [...word.tags, ...update.tags]
            })
        }
    }
}

export function dtoFromCtx(ctx: TelegrafContext, message_id?: number) {
    return {
        id: ctx.chat?.id!,
    }
}