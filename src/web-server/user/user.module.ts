import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "../../database/entity/user";
import { UserEntityService } from "./user.service";
import { UserController } from "./user.controller";

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity])],
    providers: [UserEntityService],
    controllers: [UserController]
})
export class UserModule { }