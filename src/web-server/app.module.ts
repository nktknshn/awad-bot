import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { WordModule } from './word/word.module';

@Module({
    imports: [
        UserModule,
        WordModule,
        TypeOrmModule.forRoot(),
        // GraphQLModule.forRoot({
        //     include: [ReportEntitiesModule],
        //     schema: 
        // }),
    ],
    // controllers: [AppController],
    // providers: [AppService],
})
export class AppModule { }
