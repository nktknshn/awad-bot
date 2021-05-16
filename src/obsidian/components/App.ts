import { connected } from "Lib/component";
import { setBufferedInputEnabled, setBufferedOnce, setDeferRender } from "Lib/components/actions/flush";
import { button, messagePart, nextMessage } from "Lib/elements-constructors";
import { action, caseText, ifTrue, on } from "Lib/input";
import { inputHandler, message, O } from 'Lib/lib';
import { combineSelectors, select } from "Lib/state";
import { GetSetState } from "Lib/tree2";
import { getDirs, getVaultPath, getOpenDir, getStoreActions, getFiles, getVaultName, getExpandedDirs } from '../selectors';
import { itemByUrl } from "../obs";
import { caseFileId, parseDirId } from "../util";
import { VaultDirs } from './VaultDirs';
import { OpenedFile } from './OpenedFile';
import { ifTextEqual } from "Lib/chatactions";


export const App = connected(
    select(getDirs, getStoreActions, getOpenDir, getFiles, getVaultPath,
        combineSelectors(getExpandedDirs, getVaultName),
        ({ error }: { error?: string; }) => ({ error })),
    function* (
        { error, vaultPath, vaultName, storeActions, openDir, files, dirs, expandedDirs },
        props: { expandAll: boolean; },
        local: GetSetState<{
            showEmpty: boolean;
        }>) {

        if (error)
            yield message(error);

        const { showEmpty } = local.getState({ showEmpty: false });

        yield inputHandler([
            on(caseFileId, action(
                ({ fileId }) => [
                    storeActions.openFile(
                        files[fileId].path
                    ),
                    // setDeferRender(20),
                    // setBufferedInputEnabled(true),
                    // setBufferedOnce(true),
                ]
            )),
            on(caseText, O.map((a) => a.messageText), O.chain(parseDirId), action(
                (dirId) => [
                    dirs[dirId].path == openDir
                        ? storeActions.setOpenDir(undefined) :
                        !expandedDirs.includes(dirs[dirId].path)
                            ? storeActions.toggleExpanded(dirs[dirId].path)
                            : storeActions.toggleExpanded(dirs[dirId].path)
                ]
            )),
            on(caseText,
                ifTrue(c => c.messageText == '/expand'),
                action(() =>
                    storeActions.setExpanded(dirs.map(_ => _.path))
                )),
            on(caseText,
                ifTrue(c => c.messageText == '/collapse'),
                action(() =>
                    storeActions.setExpanded([])
                ))
        ]);

        const links = [
            itemByUrl('/игра/дела/идеи дел'),
            itemByUrl('/incoming'),
            itemByUrl('/прочее/записки')
        ];

        const [ideasItem, incomingItem, notesItem] = links.map(
            link => link(vaultPath, files)
        );

        yield messagePart(`<b>${vaultName}</b>`);
        yield nextMessage();


        yield button(`Close all`, () => [
            storeActions.resetOpens()
        ]);

        yield button('🔄', () => [
            storeActions.openVault(),
        ]);

        if (dirs.find(_ => _.files.length == 0))
            yield button(`Empty (${showEmpty ? 1 : 0})`, () => [
                local.setState(local.lenses('showEmpty').set(!showEmpty)),
            ], true);


        // const incomingFile = itemByPath(path.join(vault.path, 'incoming.md'))(vault.files)
        if (incomingItem.item)
            yield button(`⭐ Incoming`, () => [
                storeActions.openFileComposed(incomingItem.item!)
            ]);

        if (notesItem.item)
            yield button(`⭐ Записки`, () => [
                storeActions.openFile(notesItem.item?.path)
            ]);

        yield VaultDirs({
            showEmpty,
            showDirLinks: !props.expandAll,
            expandedDirs: [
                ...expandedDirs,
                // incomingItem.item?.parentDirPath
                // , notesItem.item?.parentDirPath
                // , openDir
                ...(props.expandAll ? dirs.map(_ => _.path) : [openDir])
            ].filter((b): b is string => !!b)
        });

        yield OpenedFile({});

        // if (!openFile && openDir)
        //     yield button('Close dir', () => [
        //         storeActions.setOpenDir(undefined)
        //     ])
    });
