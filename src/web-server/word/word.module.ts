import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "../../database/entity/user";
import { WordEntity } from "../../database/entity/word";
import { WordEntityService } from "./word.service";
import { WordController } from "./word.controller";

@Module({
    imports: [TypeOrmModule.forFeature([WordEntity])],
    providers: [WordEntityService],
    controllers: [WordController]
})
export class WordModule { }