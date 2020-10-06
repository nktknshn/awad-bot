import {
    Column, Entity, BaseEntity, PrimaryGeneratedColumn, EntityRepository,
    Repository,
    ManyToOne
} from 'typeorm';
import { Meaning } from '../../bot/interfaces';
import { UserEntity } from './user';


@Entity({ name: 'word' })
export class WordEntity extends BaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("text")
    userId!: string;

    @Column("text", { nullable: false })
    theword!: string

    @Column("text", { nullable: true })
    transcription?: string

    @Column("text", { array: true })
    tags!: string[]

    @Column("jsonb")
    meanings!: Meaning[]

    @Column('timestamp with time zone',
        { nullable: false, default: () => 'CURRENT_TIMESTAMP' })
    created!: Date

    @ManyToOne(type => UserEntity, user => user.words)
    user!: UserEntity;
}