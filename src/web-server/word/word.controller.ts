import { Controller, Logger, Get, Post, Body, Delete, Param, Put, BadRequestException } from "@nestjs/common";
import { WordEntityService, WordDto } from './word.service'

@Controller('words')
export class WordController {
    constructor(private readonly wordService: WordEntityService) {

    }
    private readonly logger = new Logger(WordController.name)

    @Get()
    getAll() {
        return this.wordService.getAll()
    }

    @Post()
    create(@Body() wordDto: WordDto) {
        return this.wordService.create(wordDto);
    }

    @Delete(':id')
    remove(@Param('id') id: number): Promise<void> {
        return this.wordService.remove(id);
    }

    @Put()
    async update(@Body() wordDto: WordDto) {

        if(wordDto.id === undefined || !(await this.wordService.findOne(wordDto.id)))
        throw new BadRequestException('Invalid word');

        return this.wordService.save(wordDto);
    }

}