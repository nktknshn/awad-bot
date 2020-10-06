import { program } from 'commander'
import Debug from 'debug'
import { createConnection, getCustomRepository } from 'typeorm';
import { WordEntity } from './database/entity/word';
import { UserEntity } from './database/entity/user';
import { exit } from 'process';
import { readStdin } from './cli/utils';

const getEntity = {
    'word': WordEntity,
    'user': UserEntity
}

async function main() {

    program
        .command('get <entity>')
        .action(async function (entity: keyof typeof getEntity) {

            if (!(entity in getEntity)) {
                console.error(`Wrong entity ${entity}`);
                exit(1)
            }

            const conn = await createConnection()
            const reports = await conn.manager.find(getEntity[entity])

            console.log(JSON.stringify(reports));

            await conn.close()
        })

    program
        .command('post <entity>')
        .action(async function (entity: keyof typeof getEntity) {

            if (!(entity in getEntity)) {
                console.error(`Wrong entity ${entity}`);
                exit(1)
            }

            const input = (await readStdin()).join('')
            const obj = JSON.parse(input)
            const conn = await createConnection()
            const result = await conn.manager.getRepository(getEntity[entity]).insert(obj)

            console.log(result);

            await conn.close()
        })

    program.parse(process.argv)
}

main()
