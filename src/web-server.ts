import { NestFactory } from '@nestjs/core';
import { AppModule } from './web-server/app.module';
import { program } from 'commander'

async function bootstrap() {
    program
        .command('run')
        .option('-p, --port <port>', 'port', '3010')
        .action(async function (cmdObj) {
            const app = await NestFactory.create(AppModule,
                { cors: true, logger: ['log', 'debug', 'verbose', 'error', 'warn'] });

            mylog(`Running at ${cmdObj.port}`);
            await app.listen(cmdObj.port);
        })

    program.parse(process.argv)

}

bootstrap();
