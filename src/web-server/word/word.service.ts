import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WordEntity } from "../../database/entity/word";
import { Meaning } from "../../bot/interfaces";

export interface WordDto {
    id?: number
    userId: string,
    theword: string,
    transcription?: string
    tags: string[]
    meanings: Meaning[]
}

@Injectable()
export class WordEntityService {
    constructor(
        @InjectRepository(WordEntity)
        private readonly wordRepository: Repository<WordEntity>
    ) { }

    create(wordDto: WordDto) {
        return this.save(wordDto)
    }

    async save(wordDto: WordDto) {
        const word = new WordEntity()

        if (wordDto.id !== undefined)
            word.id = wordDto.id

        word.userId = wordDto.userId
        word.theword = wordDto.theword
        word.transcription = wordDto.transcription
        word.tags = wordDto.tags
        word.meanings = wordDto.meanings

        return this.wordRepository.save(word)
    }

    async getAll() {
        return this.wordRepository.find()
    }

    async remove(id: number): Promise<void> {
        await this.wordRepository.delete(id);
    }

    findOne(id: number) {
        return this.wordRepository.findOne(id);
    }

    update(wordDto: WordDto) {
        return this.save(wordDto)
    }
}
