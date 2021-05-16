import { flow, identity } from "fp-ts/lib/function"
import { E } from "Lib/lib"
import { StoreF2, storeAction, lens, StoreAction } from "Lib/storeF"
import { ObsidianVault, ObsidianFile, readdirRe1, dirToVault, ObsidianDir } from "./obs"
import path from "path";
import fs from 'fs/promises';

export type Store = {
    vault?: ObsidianVault,
    error?: string,
    openFile?: string,
    openFileContent?: string,
    openDir?: string,
}

export const storeActions = (store: StoreF2<Store>) => {
    const setOpenFile = storeAction(lens(store).openFile.set)
    const setOpenFileContent = storeAction(lens(store).openFileContent.set)

    const openFile = storeAction((file?: ObsidianFile, onReadyActions: StoreAction<Store>[] = [
        setOpenFile(file ? file.path : store.state.openFile ?? undefined)
    ]) => {
        const filePath = file ? file.path : store.state.openFile ?? undefined

        if (filePath) {
            fs.readFile(filePath)
                .then(content => {
                    store.dispatch(
                        [
                            setOpenFileContent(content.toLocaleString()),
                            ...onReadyActions,
                        ])
                })

            return lens(store).error.modify(identity)
        }

        return lens(store).error.modify(identity)
    })

    const appendLine = storeAction(
        (line: string) => {
            if (store.state.openFile)
                fs.appendFile(store.state.openFile, line).then(_ =>
                    store.dispatch(
                        [openFile()]
                    ))

            return lens(store).error.modify(identity)
        }
    )

    const setContent = storeAction(
        (content: string) => {
            if (store.state.openFile)
                fs.writeFile(store.state.openFile, content).then(_ =>
                    store.dispatch(
                        [openFile()]
                    ))

            return lens(store).error.modify(identity)
        }
    )

    const setOpenDir = storeAction(lens(store).openDir.set)

    const openVault = storeAction(
        (vaultPath?: string) => {

            vaultPath = vaultPath ?? store.state.vault!.path

            readdirRe1(vaultPath).then(
                flow(
                    E.fold(
                        error => lens(store).error.set(error.message),
                        v => {
                            const vault = dirToVault(v)
                            return flow(
                                lens(store).vault.set(vault),
                                // lens(store).openDir.set(),
                            )
                        })
                    , f => store.dispatch([{ kind: 'store-action', f }])
                ))

            return lens(store).error.modify(identity)
        }
    )

    const newDir = storeAction(
        (parentDir: ObsidianDir, dirname: string) => {
            fs.mkdir(path.join(parentDir.path, dirname))
                .then(_ =>
                    store.dispatch([openVault()])
                )

            return lens(store).error.modify(identity)
        }
    )

    const newFile = storeAction(
        (parentDir: ObsidianDir, filename: string) => {
            fs.writeFile(path.join(parentDir.path, `${filename}.md`), '')
                .then(_ =>
                    store.dispatch(
                        [openVault()]
                    ))

            return lens(store).error.modify(identity)
        }
    )

    const renameFile = storeAction(
        (oldfile: string, newFileName: string) => {

            const newPath = path.join(path.dirname(oldfile), newFileName + '.md')

            fs.rename(oldfile, newPath)
                .then(_ =>
                    store.dispatch(
                        [openVault()]
                    ))


            return lens(store).error.modify(identity)
        }
    )

    return ({
        setOpenFile, setOpenFileContent, openFile, appendLine, setContent
        , setOpenDir, newDir, newFile, openVault, renameFile
    })
}