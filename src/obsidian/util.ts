import { flow } from "fp-ts/lib/function"
import { pipe } from "fp-ts/lib/pipeable"
import { caseText } from "Lib/input"
import { O } from "../lib/lib"

const parseCommand = <T>(prefix: string, getData: (s: string) => T) => (text: string): T | undefined => {
    if (text[0] != '/')
        return

    if (!text.slice(1).startsWith(prefix))
        return

    return getData(text.slice(1 + prefix.length + 1))
}

const parseFileId = O.fromNullableK(parseCommand('file', Number.parseInt))

const parseDirId = O.fromNullableK(parseCommand('dir', Number.parseInt))

const parseVaultFileId = O.fromNullableK(parseCommand('vault_file', Number.parseInt))


const caseSomeId = <T, K extends keyof any>(parser: (text: string) => O.Option<T>, key: K) => flow(
    caseText,
    O.chain(a => pipe(
        a, a => parser(a.messageText),
        O.map(res => ({
           [key]: res,
        })),
        O.map(b => ({...b}))
    ))
)

const caseFileId = caseSomeId(parseFileId, 'fileId')
const caseVaultFileId = caseSomeId(parseVaultFileId, 'fileId')

export { parseFileId, caseFileId, parseCommand, parseDirId, caseSomeId, caseVaultFileId }