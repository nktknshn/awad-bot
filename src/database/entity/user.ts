import {
    BaseEntity, Column, Entity,
    OneToMany, PrimaryColumn, JoinColumn
} from 'typeorm';
import { WordEntity } from './word';


@Entity({ name: 'user' })
export class UserEntity extends BaseEntity {
    @PrimaryColumn("text")
    id!: string;

    @OneToMany(type => WordEntity, word => word.user, { eager: true })
    words!: WordEntity[]

    @Column('timestamp with time zone',
        { nullable: false, default: () => 'CURRENT_TIMESTAMP' })
    created!: Date
}