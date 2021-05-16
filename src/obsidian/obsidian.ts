import { pipe } from "fp-ts/lib/pipeable";
import { startBuild } from "Lib/appbuilder";
import { runbot, createLevelTracker } from "Lib/botmain";
import { connected, connected0, connected1, connectedR } from "Lib/component";
import { withTrackingRenderer } from "Lib/components/actions/tracker";
import { addDefaultBehaviour, defaultState, withStore } from "Lib/defaults";
import { button, buttonsRow, keyboardButton, messagePart, nextMessage } from "Lib/elements-constructors";
import { CA, A, AP, B, chatState, message, EC, inputHandler, O, FL } from 'Lib/lib'
import { finishBuild } from "Lib/newapp";
import { select } from "Lib/state";
import { GetSetState } from "Lib/tree2";
import * as T from 'fp-ts/lib/Task'
import * as TE from 'fp-ts/lib/TaskEither'
import * as E from 'fp-ts/lib/Either'

import fs from 'fs/promises'
import path from "path";
import { lens, StoreAction, storeAction, StoreF, storef, StoreF2 } from "Lib/storeF";
import { action, caseText, ifTrue, on } from "Lib/input";
import { flow, identity } from "fp-ts/lib/function";
import { dirToVault, getVaultDirs, itemByPath, itemByUrl, normPath, ObsidianDir, ObsidianFile, ObsidianVault, readdirRe1, Vault, withIndex } from "./obs";
import { caseFileId, caseSomeId, caseVaultFileId, parseDirId } from "./util";
import { AppActions, AppActionsFlatten, GetChatState, GetState, RequiredKeepUndefined } from "Lib/types-util";
import { InputHandlerData } from "Lib/textmessage";
import { setDeferRender, setBufferedOnce, setBufferedInputEnabled } from "Lib/components/actions/flush";


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
        dirs: getVaultDirs(c.vault),
        openDir: c.openDir,
        vaultPath: c.vault.path,
        openFile: c.openFile,
        storeActions: c.storeActions
    })),
    function* ({ dirs, openDir, vaultPath, storeActions, openFile }
        , { showEmpty, expandedDirs }: { showEmpty: boolean, expandedDirs: string[] }
        , { lenses, getState, setState }: GetSetState<{
            createItem?: 'file' | 'dir',
            itemName?: string
        }>
    ) {
        const { createItem, itemName } = getState({})

        const { item: currentDir } = itemByPath(openDir)(dirs)

        const resetCreateItem = [
            setState(lenses('createItem').set(undefined)),
            setState(lenses('itemName').set(undefined))
        ]

        // yield message(expandedDirs)
        // yield message(itemName ?? 'none')
        // yield message(createItem ?? 'none')

        yield nextMessage()

        for (const [d, idx] of withIndex(dirs)) {

            if (!showEmpty && d.files.length == 0)
                continue

            const name = normPath(vaultPath, d.path)

            const title = boldify(
                _ => openDir == d.path,
                d.files.length
                    ? `<code>${name}</code>`
                    : `${name} <code>(empty)</code>`)

            yield messagePart(`/dir_${idx}      ${title}`)

            // if (openDir == d.path)
            if (expandedDirs.includes(d.path))
                yield VaultOpenDirFiles({ dpath: d.path })
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
                onWrongInput: () => resetCreateItem
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
        vaultFiles: c.vault.files,
        // openDir: c.openDir,
        vaultPath: c.vault.path,
        // storeActions: c.storeActions,
        openFile: c.openFile
    })),
    function* ({ vaultDirs, vaultFiles, vaultPath, openFile }, { dpath }: { dpath: string },
        { getState, setState, lenses }: GetSetState<{
            createItem?: 'file' | 'dir',
            itemName?: string
        }>
    ) {

        const { item: currentDir } = itemByPath(dpath)(vaultDirs)

        if (!currentDir)
            return

        for (const f of currentDir.files) {
            const { idx } = itemByPath(f.path)(vaultFiles)

            const title = boldify(
                _ => openFile == f.path,
                italify(_ => true, path.basename(normPath(vaultPath, f.path))
                    .replace('.md', '')))

            yield messagePart(`/file_${idx}            ${title}`)
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
            autoNl: boolean,
            doAddSpace: boolean,
            addSymbol: string,
            addListItems: boolean,
            newFileName?: string
        }>) {
        const { overwright, rename, newFileName, addListItems, addSymbol } = getState({
            overwright: false,
            addListItems: true,
            autoNl: true,
            doAddSpace: false,
            addSymbol: '\n',
            rename: false,
        })

        if (!openFile)
            return

        const setOverwright = (b: boolean) => setState(lenses('overwright').set(b))
        const setAddListItems = (b: boolean) => setState(lenses('addListItems').set(b))
        const setAutoNl = (b: boolean) => setState(lenses('autoNl').set(b))
        const setAddSymbol = (addSymbol: string) => setState(lenses('addSymbol').set(addSymbol))


        const setRename = (b: boolean) => setState(lenses('rename').set(b))
        const setNewFileName = (fname?: string) => setState(lenses('newFileName').set(fname))
        const resetRename = [setRename(false), setNewFileName(undefined)]

        const mapMessageText = (messageText: string) => addListItems ? '- ' + messageText : messageText
        const addNil = (messageText: string) => messageText + addSymbol

        // const addSpace = (messageText: string) => doAddSpace ? messageText + ' ' : messageText

        yield inputHandler([
            on(caseText
                , ifTrue(_ => openFileContent !== undefined)
                , ifTrue(c => !c.messageText.startsWith('/'))
                , action(({ messageText }) =>
                    overwright
                        ? [setOverwright(false), storeActions.setContent(
                            pipe(
                                messageText
                                , messageText =>
                                    messageText[messageText.length - 2] == '\n'
                                        && messageText[messageText.length - 1] == '>'
                                        ? messageText.slice(0, messageText.length - 1)
                                        : messageText
                            ))]
                        : storeActions.appendLine(
                            pipe(messageText
                                , mapMessageText
                                , addNil
                            ))
                ))
        ])

        const formatContent = (content: string) => pipe(
            content.split('\n')
            , A.map(line => boldify(_ => line.startsWith('#'), line))
            , A.map(line => line.replace(/\[\[(.+)\]\]/, '<code>[[$1]]</code>'))
            , list => list.join('\n')
            , text => text.length && text[text.length - 1] == '\n'
                ? text + '<code>></code>'
                : text
        )

        if (openFileContent !== undefined)
            yield message(openFileContent.length ? formatContent(openFileContent) : '<code>empty</code>')
        else
            return

        if (rename && !newFileName) {
            yield InputBox({
                title: `Rename ${path.basename(openFile).replace('.md', '')} to ...`,
                cancelTitle: 'Cancel',
                onCancel: () => resetRename,
                onSuccess: name => [setNewFileName(name)],
                onWrongInput: () => []
            })
            return
        }
        else if (rename && newFileName) {
            yield message(`Rename ${path.basename(openFile).replace('.md', '')} to ${newFileName}?`)
            yield button('Yes', () => [
                resetRename,
                storeActions.renameFile(openFile, newFileName),
            ])
            yield button('No', () => resetRename)
            return
        }

        // yield button(`space (${doAddSpace})`,
        //     () => setDoAddSpace(!doAddSpace))
        if (!overwright) {
            if (!addListItems)
                yield button(`auto NL (${addSymbol.charCodeAt(0)})`,
                    () => addSymbol == '\n' ? setAddSymbol(' ') : addSymbol == ' ' ? setAddSymbol('') : setAddSymbol('\n'))

            yield button(`\\n`,
                () => storeActions.appendLine('\n'))

            yield button(`List ${addListItems ? '☑' : '☐'}`,
                () => setAddListItems(!addListItems))
        }

        yield button(`Replace ${overwright ? '☑' : '☐'}`,
            () => setOverwright(!overwright), true)

        yield button(`Rename`,
            () => setRename(true))

        if (openFile)
            yield button('Close file', () => [
                storeActions.setOpenFile(undefined)
            ])
    })


const App = connected(
    select<Store & WithStoreActions>((s) => ({
        storeActions: s.storeActions,
        error: s.error,
        vault: s.vault,
        openDir: s.openDir
    })),
    function* ({ error, vault, storeActions, openDir }, props: { expandAll: boolean }, local: GetSetState<{
        showEmpty: boolean,

    }>) {

        if (error)
            yield message(error)

        if (!vault)
            return

        const { showEmpty } = local.getState({ showEmpty: false })

        yield inputHandler([
            on(caseFileId, action(
                ({ fileId }) => [
                    storeActions.openFile(
                        vault.files[fileId]
                    ),
                    setDeferRender(1),
                    setBufferedInputEnabled(true),
                    setBufferedOnce(true),
                ]
            ))
            // on(caseVaultFileId, action(({ fileId }) => storeActions.openFile(
            //     vault.files[fileId]
            // )))
            , on(caseText, O.map((a) => a.messageText), O.chain(parseDirId), action(
                (dirId) => [storeActions.setOpenDir(getVaultDirs(vault)[dirId].path)]
            )),
        ])

        const links = [
            itemByUrl('игра/дела/идеи дел')
            , itemByUrl('incoming')
            , itemByUrl('прочее/записки')
        ]

        const [ideasItem, incomingItem, notesItem] = links.map(
            link => link(vault.path, vault.files)
        )

        yield messagePart(`<b>${vault.name}</b>`)
        yield nextMessage()


        yield button(`Close all`, () => [
            storeActions.setOpenFile(undefined),
            storeActions.setOpenDir(undefined)
        ])

        yield button('🔄', () => [
            storeActions.openVault(),
        ])

        if (vault.dirs.find((_) => _.files.length == 0))
            yield button(`Empty (${showEmpty ? 1 : 0})`, () => [
                local.setState(local.lenses('showEmpty').set(!showEmpty)),
            ], true)


        // const incomingFile = itemByPath(path.join(vault.path, 'incoming.md'))(vault.files)

        if (incomingItem.item)
            yield button(`Incoming`, () => [
                storeActions.openFile(incomingItem.item, [
                    storeActions.setOpenFile(incomingItem.item!.path),
                ])
            ])

        if (notesItem.item)
            yield button(`Записки`, () => [
                storeActions.openFile(notesItem.item, [
                    storeActions.setOpenFile(notesItem.item!.path),
                ])
            ])

        yield VaultDirs({
            showEmpty, expandedDirs: [
                // incomingItem.item?.parentDirPath
                // , notesItem.item?.parentDirPath
                // , openDir
                ...(props.expandAll ? vault.dirs.map(_ => _.path) : [openDir])
            ].filter((b): b is string => !!b)
        })

        yield OpenedFile({})

        // if (!openFile && openDir)
        //     yield button('Close dir', () => [
        //         storeActions.setOpenDir(undefined)
        //     ])
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
    , a => withStore(a, {
        storeKey: 'store', storeAction: apply => a.actions([
            apply,
            FL.deferredRender({
                waitForTimer: true
            }),
            // CA.render,
        ])
    })
    , AP.context(stateToContext)
    , AP.props({
        expandAll: false
    })
    , AP.withInit(a => a.actions([a.ext.defaultInit(), a.ext.attachStore_store]))
    , a => AP.complete(a)
    , AP.withCreateApplication
)

runbot({
    app: createApplication({
        vaultPath: '/home/horn/Documents/my1'
    })
})