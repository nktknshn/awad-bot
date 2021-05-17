import { connected } from "Lib/component";
import { button, messagePart, nextMessage } from "Lib/elements-constructors";
import { action, caseText, ifTrue, on } from "Lib/input";
import { inputHandler, message, O } from 'Lib/lib';
import { combineSelectors, select } from "Lib/state";
import { GetSetState } from "Lib/tree2";
import { getBookmarks, getDirs, getExpandedDirs, getFiles, getOpenDir, getOpenFile, getOpenFileContent, getStoreActions, getVaultName } from '../selectors';
import { caseFileId, parseDirId } from "../util";
import { OpenedFile } from './OpenedFile';
import { VaultDirs } from './VaultDirs';

export const App = connected(
    select(getDirs, getStoreActions,
        combineSelectors(getOpenDir, getBookmarks),
        combineSelectors(getFiles, getOpenFileContent),
        getOpenFile,
        combineSelectors(getExpandedDirs, getVaultName),
        ({ error }: { error?: string; }) => ({ error })),
    function* (
        { error, bookmarks, vaultName, storeActions, openDir, openFile,
            openFileContent, files, dirs, expandedDirs },
        props: {},
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
                        [
                            storeActions.setOpenDir(dirs[dirId].path),
                            storeActions.setExpanded([dirs[dirId].path])]
                    // !expandedDirs.includes(dirs[dirId].path)
                    //     ? storeActions.setExpanded([dirs[dirId].path])
                    //     : storeActions.setExpanded([dirs[dirId].path])
                    // ]
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
            , on(caseText,
                ifTrue(c => c.messageText == '/refresh'),
                action(() =>
                    storeActions.openVault()
                ))
            , on(caseText,
                ifTrue(c => c.messageText == '/close'),
                action(() =>
                    storeActions.resetOpens()
                ))
        ]);

        yield messagePart(`<b>${vaultName}</b>`);
        yield messagePart(``);
        yield messagePart(`/refresh  /close`);
        yield nextMessage();

        // yield button(`Close all`, () => [
        //     storeActions.resetOpens()
        // ]);

        // yield button('🔄', () => [
        //     storeActions.openVault(),
        // ], true);

        if (dirs.find(_ => _.files.length == 0))
            yield button(`Empty (${showEmpty ? 1 : 0})`, () => [
                local.set('showEmpty')(!showEmpty),
            ]);

        for (const { item } of bookmarks) {
            yield button(`⭐ ${item.name.replace('.md', '')}`, () => [
                storeActions.openFileComposed(item)
            ]);
        }

        yield VaultDirs({
            showEmpty,
            showDirLinks: true,
            expandedDirs: expandedDirs.filter((b): b is string => !!b)
        });

        yield OpenedFile({
            openFile, openFileContent
        });
    });
