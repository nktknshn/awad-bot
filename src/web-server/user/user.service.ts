import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserEntity } from "../../database/entity/user";
import { Repository } from "typeorm";

@Injectable()
export class UserEntityService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>
    ) { }

    create(userDto: {id: string}): Promise<UserEntity> {
        const user = new UserEntity()
        user.id = userDto.id
        return this.userRepository.save(user)
    }

    async getAll() {
        return this.userRepository.find()
    }

    async remove(id: string): Promise<void> {
        await this.userRepository.delete(id);
    }
}
