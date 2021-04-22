import {
    BaseEntity, Column, Entity,
    OneToMany, PrimaryColumn, JoinColumn, EntityRepository, Repository
} from 'typeorm';
import { WordEntity } from './word';


@Entity({ name: 'user' })
export class UserEntity extends BaseEntity {
    @PrimaryColumn()
    id!: string;

    @OneToMany(type => WordEntity, word => word.user, { eager: true })
    words!: WordEntity[]

    @Column('timestamp with time zone',
        { nullable: false, default: () => 'CURRENT_TIMESTAMP' })
    created!: Date

    @Column('int', { array: true, nullable: false, default: '{}' })
    renderedMessagesIds: number[] = []
}


@EntityRepository(UserEntity)
export class UserRepository extends Repository<UserEntity> {

    addRenderedMessage(userId: number, messageId: number) {
        return this.query(
            `UPDATE "user" SET "renderedMessagesIds" = array_append("user"."renderedMessagesIds",$1) WHERE id = $2`, [messageId, userId]
        )
    }
    
    removeRenderedMessage(userId: number, messageId: number) {
        return this.query(
            `UPDATE "user" SET "renderedMessagesIds" = array_remove("user"."renderedMessagesIds",$1) WHERE id = $2`, [messageId, userId]
        )
    }

    getRenderedMessage(chatId: number): Promise<number[]> {
        return this.query(
            `SELECT "renderedMessagesIds" FROM "user WHERE id = $1`, [chatId]
        )
    }

}