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
const caseFileId = flow(
    caseText,
    O.chain(a => pipe(
        a, a => parseFileId(a.messageText),
        O.map(fileId => ({
            ...a, fileId
        }))
    ))
)
const parseDirId = O.fromNullableK(parseCommand('dir', Number.parseInt))

export { parseFileId, caseFileId, parseCommand, parseDirId }