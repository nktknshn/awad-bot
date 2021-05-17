import { pipe } from 'fp-ts/lib/pipeable'
import {readVaultConfig, readdirRe1, dirToVault, ObsidianDir} from './obs'
import * as E from 'fp-ts/lib/Either'

test('readVaultConfig', async () => {

    const dirE: E.Either<{message: string}, ObsidianDir> = await readdirRe1('/home/horn/Documents/my1')
    
    if(E.isLeft(dirE))
        return

    const dir = dirE.right
    const vault = dirToVault(dir)

    const config = await readVaultConfig(vault)

    console.log(config.bookmarks);
    
})