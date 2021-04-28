import {
    Column, Entity, BaseEntity, PrimaryGeneratedColumn, EntityRepository,
    Repository,
    ManyToOne
} from 'typeorm';
import { Meaning } from '../../bot/interfaces';
import { UserEntity } from './user';
import 'reflect-metadata'

@Entity({ name: 'word' })
// @ObjectType()
export class WordEntity extends BaseEntity {
    // @Field(() => ID)
    @PrimaryGeneratedColumn()
    id!: number;

    // @Field(() => String)
    @Column("text")
    userId!: string;

    // @Field(() => String)
    @Column("text", { nullable: false })
    theword!: string

    // @Field(() => String)
    @Column("text", { nullable: true })
    transcription?: string

    // @Field(() => [String])
    @Column("text", { array: true })
    tags!: string[]

    // @Field(() => [String])
    @Column("text", { array: true, default: '{}', nullable: false })
    translations!: string[]

    @Column("jsonb")
    meanings!: Meaning[]

    // @Field(() => Date)
    @Column('timestamp with time zone',
        { nullable: false, default: () => 'CURRENT_TIMESTAMP' })
    created!: Date

    @ManyToOne(type => UserEntity, user => user.words)
    user!: UserEntity;
}