import { pipe } from "fp-ts/lib/pipeable";
import { startBuild } from "Lib/appbuilder";
import { runbot, createLevelTracker } from "Lib/botmain";
import { connected, connected0, connected1, connectedR } from "Lib/component";
import { withTrackingRenderer } from "Lib/components/actions/tracker";
import { addDefaultBehaviour, defaultState, withStore } from "Lib/defaults";
import { button, buttonsRow, keyboardButton, messagePart, nextMessage } from "Lib/elements-constructors";
import { CA, A, AP, B, chatState, message, EC, inputHandler, O } from 'Lib/lib'
import { finishBuild } from "Lib/newapp";
import { select } from "Lib/state";
import { GetSetState } from "Lib/tree2";
import * as T from 'fp-ts/lib/Task'
import * as TE from 'fp-ts/lib/TaskEither'
import * as E from 'fp-ts/lib/Either'

import fs from 'fs/promises'
import path from "path";
import { lens, storeAction, StoreF, storef, StoreF2 } from "Lib/storeF";
import { action, caseText, ifTrue, on } from "Lib/input";
import { flow, identity } from "fp-ts/lib/function";
import { dirToVault, getVaultDirs, itemByPath, normPath, ObsidianDir, ObsidianFile, ObsidianVault, readdirRe1, Vault, withIndex } from "./obs";
import { caseFileId, parseDirId } from "./util";
import { AppActions, AppActionsFlatten, GetChatState, GetState, RequiredKeepUndefined } from "Lib/types-util";
import { InputHandlerData } from "Lib/textmessage";
import { deferRender, setBufferedOnce, setBufferedInputEnabled } from "Lib/components/actions/flush";


const InputBox = connected0(function* InputBox<R1, R2, R3>({ title, onCancel, onSuccess, onWrongInput, cancelTitle = 'Cancel' }: {
    title: string,
    cancelTitle?: string,
    onCancel: () => R1,
    onSuccess: (text: string) => R2,
    onWrongInput: (ctx: InputHandlerData) => R3,
}) {

    yield inputHandler([
        on(caseText, action(({ messageText }) => onSuccess(messageText))),
    ])

    yield message(title)

    yield button(cancelTitle, () => onCancel())
})


type Store = {
    vault?: ObsidianVault,
    error?: string,
    openFile?: string,
    openFileContent?: string,
    openDir?: string,
}

const storeActions = (store: StoreF2<Store>) => {
    const setOpenFile = storeAction(lens(store).openFile.set)
    const setOpenFileContent = storeAction(lens(store).openFileContent.set)

    const openFile = storeAction((file?: ObsidianFile) => {
        const filePath = file ? file.path : store.state.openFile ?? undefined

        if (filePath) {
            fs.readFile(filePath)
                .then(content => {
                    store.dispatch({
                        kind: 'store-action', f:
                            lens(store).openFileContent.set(content.toLocaleString())
                    })
                })

            return lens(store).openFile.set(filePath)
        }

        return lens(store).error.modify(identity)
    })

    const appendLine = storeAction(
        (line: string) => {
            if (store.state.openFile)
                fs.appendFile(store.state.openFile, line + '\n').then(_ =>
                    store.dispatch(
                        openFile()
                    ))

            return lens(store).error.modify(identity)
        }
    )
    const setContent = storeAction(
        (content: string) => {
            if (store.state.openFile)
                fs.writeFile(store.state.openFile, content).then(_ =>
                    store.dispatch(
                        openFile()
                    ))

            return lens(store).error.modify(identity)
        }
    )

    const setOpenDir = storeAction(lens(store).openDir.set)

    const openVault = storeAction(
        (vaultPath?: string) => {

            vaultPath = vaultPath ?? store.state.vault!.path

            console.log('vaultPath vaultPath vaultPath');
            console.log(vaultPath);

            readdirRe1(vaultPath).then(
                flow(
                    E.fold(
                        error => lens(store).error.set(error.message),
                        v => {
                            console.log('dirToVault(vault).files')
                            console.log(dirToVault(v).files);

                            const vault = dirToVault(v)
                            return flow(
                                lens(store).vault.set(vault),
                                // lens(store).openDir.set(),
                            )
                        })
                    , f => store.dispatch({ kind: 'store-action', f })
                ))

            return lens(store).error.modify(identity)
        }
    )

    const newDir = storeAction(
        (parentDir: ObsidianDir, dirname: string) => {
            fs.mkdir(path.join(parentDir.path, dirname))
                .then(_ =>
                    store.dispatch(openVault())
                )

            return lens(store).error.modify(identity)
        }
    )

    const newFile = storeAction(
        (parentDir: ObsidianDir, filename: string) => {
            fs.writeFile(path.join(parentDir.path, `${filename}.md`), '')
                .then(_ =>
                    store.dispatch(
                        openVault()
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
                        openVault()
                    ))


            return lens(store).error.modify(identity)
        }
    )

    return ({
        setOpenFile, setOpenFileContent, openFile, appendLine, setContent
        , setOpenDir, newDir, newFile, openVault, renameFile
    })
}

const store = async (dir: string) =>
    readdirRe1(dir)
        .then(
            E.fold(error => ({ error: error.message }) as RequiredKeepUndefined<Store>, vault => ({
                vault: dirToVault(vault),
                error: undefined,
                openFile: undefined,
                openFileContent: undefined,
                openDir: undefined
            }))
        ).then(
            res => storef<Store>(res)
        )

const state = (d: { vaultPath: string }) => chatState([
    defaultState(),
    withTrackingRenderer(createLevelTracker('mydb_bot7')),
    async () => ({
        store: await store(d.vaultPath)
    })
])

type WithStoreActions = Record<'storeActions', ReturnType<typeof storeActions>>

const VaultDirs = connected(
    select((c: { vault: ObsidianVault, openFile?: string, openDir?: string } & WithStoreActions) =>
    ({
        currentDir: itemByPath(c.openDir)(c.vault.dirs),
        dirs: getVaultDirs(c.vault),
        openDir: c.openDir,
        vaultPath: c.vault.path,
        openFile: c.openFile,
        storeActions: c.storeActions
    })),
    function* ({ dirs, openDir, vaultPath, storeActions, openFile, currentDir }
        , { showEmpty }: { showEmpty: boolean }
        , { lenses, getState, setState }: GetSetState<{
            createItem?: 'file' | 'dir',
            itemName?: string
        }>
    ) {
        const { createItem, itemName } = getState({})

        const resetCreateItem = [
            setState(lenses('createItem').set(undefined)),
            setState(lenses('itemName').set(undefined))
        ]

        yield nextMessage()

        for (const [d, idx] of withIndex(dirs)) {

            if (!showEmpty && d.files.length == 0)
                continue

            const name = normPath(vaultPath, d.path)

            const title = boldify(
                _ => openDir == d.path,
                d.files.length
                    ? `${name}`
                    : `${name} <code>(empty)</code>`)

            yield messagePart(`/dir_${idx}      ${title}`)

            if (openDir == d.path)
                yield VaultOpenDirFiles({})
        }

        if (!openFile && openDir) {
            yield button(`New file`, () => setState(lenses('createItem').set('file')))
            yield button(`New dir`, () => setState(lenses('createItem').set('dir')))
        }

        if (createItem && !itemName) {
            yield InputBox({
                title: createItem === 'file' ? 'File name:' : 'Dir name:',
                cancelTitle: 'Cancel',
                onCancel: () => [setState(lenses('createItem').set(undefined))],
                onSuccess: name => [setState(lenses('itemName').set(name))],
                onWrongInput: () => []
            })
        }
        else if (createItem && itemName && currentDir) {
            yield message(`Create ${createItem} ${itemName} at ${normPath(vaultPath, openDir ?? '/')}?`)
            yield button('Yes', () => [
                resetCreateItem,
                createItem === 'file'
                    ? storeActions.newFile(currentDir, itemName)
                    : storeActions.newDir(currentDir, itemName),
            ])
            yield button('No', () => resetCreateItem)
        }

        yield nextMessage()
    })

const VaultOpenDirFiles = connected(
    select((c: { vault: ObsidianVault, openDir?: string, openFile?: string }
        & WithStoreActions) =>
    ({
        vaultDirs: c.vault.dirs,
        openDir: c.openDir,
        vaultPath: c.vault.path,
        storeActions: c.storeActions,
        openFile: c.openFile
    })),
    function* ({ vaultDirs, openDir, vaultPath, storeActions, openFile }, { }: {},
        { getState, setState, lenses }: GetSetState<{
            createItem?: 'file' | 'dir',
            itemName?: string
        }>
    ) {

        const currentDir = itemByPath(openDir)(vaultDirs)

        if (!openDir || !currentDir)
            return

        for (const [f, idx] of withIndex(currentDir.files)) {
            const title = boldify(
                _ => openFile == f.path,
                italify(_ => true, path.basename(normPath(vaultPath, f.path))
                    .replace('.md', '')))

            yield messagePart(`/file_${idx}          ${title}`)
        }

    })

const boldify = (pred: (t: string) => boolean, text: string) => pred(text) ? `<b>${text}</b>` : text
const italify = (pred: (t: string) => boolean, text: string) => pred(text) ? `<i>${text}</i>` : text

const OpenedFile = connected(
    select((c: { openFile?: string, openFileContent?: string }
        & WithStoreActions) =>
    ({
        openFileContent: c.openFileContent,
        openFile: c.openFile,
        storeActions: c.storeActions
    })),
    function* ({ openFileContent, openFile, storeActions }, { }: {},
        { getState, setState, lenses }: GetSetState<{
            overwright: boolean,
            rename: boolean,
            newFileName?: string
        }>) {
        const { overwright, rename, newFileName } = getState({
            overwright: false,
            rename: false,
        })

        const setOverwright = (b: boolean) => setState(lenses('overwright').set(b))
        const setRename = (b: boolean) => setState(lenses('rename').set(b))
        const setNewFileName = (fname?: string) => setState(lenses('newFileName').set(fname))
        const resetRename = [setRename(false), setNewFileName(undefined)]
        yield inputHandler([
            on(caseText
                , ifTrue(_ => openFileContent !== undefined)
                , ifTrue(c => !c.messageText.startsWith('/'))
                , action(({ messageText }) =>
                    overwright
                        ? [setOverwright(false), storeActions.setContent(messageText)]
                        : storeActions.appendLine(messageText)
                ))
        ])

        if (!openFile)
            return

        if (openFileContent !== undefined)
            yield message(openFileContent.length ? openFileContent : '<code>empty</code>')
        else
            return

        if (rename && !newFileName) {
            yield InputBox({
                title: `Rename ${path.basename(openFile)} to ?`,
                cancelTitle: 'Cancel',
                onCancel: () => resetRename,
                onSuccess: name => [setNewFileName(name)],
                onWrongInput: () => []
            })
            return
        }
        else if (rename && newFileName) {
            yield message(`Rename ${path.basename(openFile)} to ${newFileName}?`)
            yield button('Yes', () => [
                resetRename,
                storeActions.renameFile(openFile, newFileName),
            ])
            yield button('No', () => resetRename)
            return
        }

        yield button(`Overwright ${overwright ? '☑' : '☐'}`,
            () => setOverwright(!overwright))

        yield button(`Rename`,
            () => setRename(true))

    })


const App = connected(
    select<Store & WithStoreActions>((s) => ({
        storeActions: s.storeActions,
        error: s.error,
        vault: s.vault,
        openFile: s.openFile,
        openFileContent: s.openFileContent,
        openDir: s.openDir
    })),
    function* ({ error, vault, openFile, storeActions, openDir }, props: {}, local: GetSetState<{
        showEmpty: boolean
    }>) {

        if (error)
            yield message(error)

        if (!vault)
            return

        const { showEmpty } = local.getState({ showEmpty: false })

        yield inputHandler([
            on(caseFileId, action(
                ({ fileId }) => [
                    openDir
                        ? [
                            // setBufferedOnce(true),
                            // setBufferedInputEnabled(true),
                            // deferRender(1000),
                            storeActions.openFile(
                                getVaultDirs(vault).find(_ => _.path == openDir)?.files[fileId]
                            )
                        ]
                        : []]
            )),
            on(caseText, O.map((a) => a.messageText), O.chain(parseDirId), action(
                (dirId) => [storeActions.setOpenDir(getVaultDirs(vault)[dirId].path)]
            )),
        ])

        yield message(`<b>${vault.name}</b>`)

        yield button('🔄', () => [
            storeActions.openVault(),
        ])

        yield button(`Empty (${showEmpty ? 1 : 0})`, () => [
            local.setState(local.lenses('showEmpty').set(!showEmpty)),
        ])

        yield button(`Close all`, () => [
            storeActions.setOpenFile(undefined),
            storeActions.setOpenDir(undefined)
        ])

        const incomingFile = itemByPath(path.join(vault.path, 'incoming.md'))(vault.files)

        if (incomingFile)
            yield button(`Incoming`, () => [
                storeActions.setOpenDir(vault.path),
                storeActions.openFile(incomingFile)
            ])

        yield VaultDirs({ showEmpty })

        yield OpenedFile({})

        if (openFile || openDir)
            yield button(openFile ? 'Close file' : 'Close dir', () => [
                openFile
                    ? storeActions.setOpenFile(undefined)
                    : storeActions.setOpenDir(undefined),
            ])

    })

export const stateToContext = (cs: GetState<typeof state>) => ({
    vault: cs.store.state.vault,
    error: cs.store.state.error,
    openFile: cs.store.state.openFile,
    storeActions: storeActions(cs.store),
    openFileContent: cs.store.state.openFileContent,
    openDir: cs.store.state.openDir
})

const { createApplication } = pipe(
    startBuild(App, state)
    , addDefaultBehaviour
    , a => withStore(a, { storeKey: 'store' })
    , AP.context(stateToContext)
    , AP.withInit(a => a.actions([a.ext.defaultInit(), a.ext.attachStore_store]))
    , a => AP.complete(a)
    , AP.withCreateApplication
)

runbot({
    app: createApplication({
        vaultPath: '/home/horn/Documents/my1'
    })
})