import { connected } from "Lib/component";
import { setBufferedInputEnabled, setBufferedOnce, setDeferRender } from "Lib/components/actions/flush";
import { button, messagePart, nextMessage } from "Lib/elements-constructors";
import { action, caseText, on } from "Lib/input";
import { inputHandler, message, O } from 'Lib/lib';
import { select } from "Lib/state";
import { GetSetState } from "Lib/tree2";
import { getDirs, getVaultPath, getOpenDir, getStoreActions, getFiles, getVaultName } from '../selectors';
import { itemByUrl } from "../obs";
import { caseFileId, parseDirId } from "../util";
import { VaultDirs } from './VaultDirs';
import { OpenedFile } from './OpenedFile';


export const App = connected(
    select(getDirs, getStoreActions, getOpenDir, getFiles, getVaultPath, getVaultName,
        ({ error }: { error?: string; }) => ({ error })),
    function* (
        { error, vaultPath, vaultName, storeActions, openDir, files, dirs },
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
                        files[fileId]
                    ),
                    setDeferRender(20),
                    setBufferedInputEnabled(true),
                    setBufferedOnce(true),
                ]
            )),
            on(caseText, O.map((a) => a.messageText), O.chain(parseDirId), action(
                (dirId) => [storeActions.setOpenDir(dirs[dirId].path)]
            )),
        ]);

        const links = [
            itemByUrl('игра/дела/идеи дел'),
            itemByUrl('incoming'),
            itemByUrl('прочее/записки')
        ];

        const [ideasItem, incomingItem, notesItem] = links.map(
            link => link(vaultPath, files)
        );

        yield messagePart(`<b>${vaultName}</b>`);
        yield nextMessage();


        yield button(`Close all`, () => [
            storeActions.setOpenFile(undefined),
            storeActions.setOpenDir(undefined)
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
                storeActions.openFile(incomingItem.item, [
                    storeActions.setOpenFile(incomingItem.item!.path),
                ])
            ]);

        if (notesItem.item)
            yield button(`⭐ Записки`, () => [
                storeActions.openFile(notesItem.item, [
                    storeActions.setOpenFile(notesItem.item!.path),
                ])
            ]);

        yield VaultDirs({
            showEmpty, expandedDirs: [
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
