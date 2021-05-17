import { flow, identity } from "fp-ts/lib/function"
import { E } from "Lib/lib"
import { StoreF2, storeAction, lens, StoreAction } from "Lib/storeF"
import { ObsidianVault, ObsidianFile, readdirRe1, dirToVault, ObsidianDir, ObsidianConfig, readVaultConfig } from "./obs"
import path from "path";
import fs from 'fs/promises';
import { append } from "bot3/util";
import { AP, CA, chatState, FL, TE, T } from 'Lib/lib';
import { pipe } from "fp-ts/lib/pipeable";
import { RequiredKeepUndefined } from "Lib/types-util";

export const readStore = (dir: string) => {
    return pipe(
        readdirRe1(dir)
        , TE.map(dirToVault)
        , TE.chain(vault =>
            TE.tryCatch(
                () => readVaultConfig(vault).then(vaultConfig => ({
                    vaultConfig,
                    vault
                })),
                () => ({ message: 'error loading config' })))
        , TE.fold(
            error => async () => ({ error: error.message }) as RequiredKeepUndefined<Store>
            , ({ vaultConfig, vault }) => async () => ({
                vault,
                vaultConfig,
                error: undefined,
                openFile: undefined,
                openFileContent: undefined,
                openDir: undefined,
                expandedDirs: []
            })
        )
    )
}

export type Store = {
    vault?: ObsidianVault,
    vaultConfig?: ObsidianConfig,
    error?: string,
    openFile?: string,
    openFileContent?: string,
    openDir?: string,
    expandedDirs: string[]
}

const nop = (s: Store) => s

const openFile = storeAction((file?: string) => (state: Store) => {

    const filePath = file ?? state.openFile ?? undefined

    return state
    // return nop
})

export const storeActions = (store: StoreF2<Store>) => {
    const setOpenFile = storeAction(lens(store).openFile.set)
    const setOpenDir = storeAction(lens(store).openDir.set)

    const setOpenFileContentComposed = storeAction(
        (content: string, filePath?: string) => flow(
            setOpenFileContent(content).f, setOpenFile(filePath).f
        )
    )
    const setOpenFileContent = storeAction(lens(store).openFileContent.set)

    const openFile = storeAction((file?: string) => {

        const filePath = file ?? store.state.openFile ?? undefined

        if (filePath) {
            fs.readFile(filePath)
                .then(content => {
                    store.dispatch(
                        setOpenFileContentComposed(content.toLocaleString(), file)
                    )
                })

            return nop
        }

        return nop
    })

    const appendLine = storeAction(
        (line: string) => {
            if (store.state.openFile)
                fs.appendFile(store.state.openFile, line).then(_ =>
                    store.dispatch(
                        [openFile(store.state.openFile)]
                    ))

            return nop
        }
    )

    const setContent = storeAction(
        (content: string) => {
            if (store.state.openFile)
                fs.writeFile(store.state.openFile, content).then(_ =>
                    store.dispatch(
                        [openFile(store.state.openFile)]
                    ))

            return nop
        }
    )

    const openVault = storeAction(
        (vaultPath?: string) => {

            vaultPath = vaultPath ?? store.state.vault!.path

            readStore(vaultPath)().then(state =>
                store.dispatch([{
                    kind: 'store-action', f:
                        state.error
                            ? lens(store).error.set(state.error)
                            : flow(
                                lens(store).vault.set(state.vault),
                                lens(store).vaultConfig.set(state.vaultConfig)
                            )
                }, openFile(store.state.openFile)])
            )

            return nop
        }
    )

    const newDir = storeAction(
        (parentDir: ObsidianDir, dirname: string) => {
            fs.mkdir(path.join(parentDir.path, dirname))
                .then(_ =>
                    store.dispatch([openVault()])
                )

            return nop
        }
    )

    const newFile = storeAction(
        (parentDir: ObsidianDir, filename: string) => {
            fs.writeFile(path.join(parentDir.path, `${filename}.md`), '')
                .then(_ =>
                    store.dispatch(
                        [openVault()]
                    ))

            return nop
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


            return nop
        }
    )

    const resetOpens = storeAction(
        () => flow(setOpenDir(undefined).f, setOpenFile(undefined).f)
    )
    const openFileComposed = storeAction(
        (item: ObsidianFile) => flow(openFile(item.path).f, setOpenFile(item.path).f)
    )

    const toggleExpanded = storeAction(
        (dir: string) => !store.state.expandedDirs.includes(dir)
            ? lens(store).expandedDirs.modify(append(dir))
            : lens(store).expandedDirs.modify(ds => ds.filter(_ => _ != dir))
    )
    const setExpanded = storeAction(
        lens(store).expandedDirs.set
    )

    return ({
        setOpenFile, setOpenFileContent, openFile, appendLine, setContent
        , setOpenDir, newDir, newFile, openVault, renameFile, resetOpens,
        openFileComposed, toggleExpanded, setExpanded
    })
}