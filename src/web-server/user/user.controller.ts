import { Controller, Logger, Get, Post, Body, Delete, Param } from "@nestjs/common";
import { UserEntityService } from "./user.service";

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserEntityService) {

    }
    private readonly logger = new Logger(UserController.name)

    @Get()
    getAll() {
        return this.userService.getAll()
    }

    @Post()
    create(@Body() userDto: { id: string }) {
        return this.userService.create(userDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string): Promise<void> {
        return this.userService.remove(id);
    }
    
}