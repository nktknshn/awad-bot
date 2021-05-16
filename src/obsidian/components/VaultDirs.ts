import { connected } from "Lib/component";
import { button, messagePart, nextMessage } from "Lib/elements-constructors";
import { message } from 'Lib/lib';
import { select } from "Lib/state";
import { GetSetState } from "Lib/tree2";
import { getCurrentDir, getDirs, getVaultPath, getOpenDir, getOpenFile, getStoreActions } from '../selectors';
import { itemByPath, normPath, withIndex } from "../obs";
import { boldify, brailleSymbol } from "../util";
import { InputBox } from './InputBox';
import { VaultOpenDirFiles } from "./VaultOpenDirFiles";

export const VaultDirs = connected(
    select(getCurrentDir, getDirs, getVaultPath, getOpenDir, getOpenFile, getStoreActions),
    function* ({ dirs, openDir, vaultPath, storeActions, openFile, currentDir },
        { showEmpty, expandedDirs, showDirLinks }: { showDirLinks: boolean, showEmpty: boolean; expandedDirs: string[]; },
        { setter, getState }: GetSetState<{
            createItem?: 'file' | 'dir';
            itemName?: string;
        }>
    ) {
        const { createItem, itemName } = getState({});

        const resetCreateItem = [
            setter('createItem').set(undefined),
            setter('itemName').set(undefined)
        ];

        yield nextMessage();

        for (const [d, idx] of withIndex(dirs)) {

            if (!showEmpty && d.files.length == 0)
                continue;

            const name = normPath(vaultPath, d.path);

            const isRoot = name == '/'

            const title = boldify(
                _ => openDir == d.path,
                d.files.length
                    ? `<code>${name}</code>`
                    : `${name} <code>(empty)</code>`);

            if (!isRoot)
                if (showDirLinks)
                    yield messagePart(`/dir_${idx}          ${title}`);
                else
                    yield messagePart(`${brailleSymbol}           ${title}`);

            if (expandedDirs.includes(d.path) || isRoot) {
                const dir = itemByPath(d.path)(dirs)?.item;

                if (!dir)
                    continue

                yield VaultOpenDirFiles({ dir });
            }
        }

        yield messagePart('');
        yield messagePart('/expand   /collapse   /as_list');

        if (!openFile && openDir) {
            yield button(`New file`, () => setter('createItem').set('file'));
            yield button(`New dir`, () => setter('createItem').set('dir'));
        }

        if (createItem && !itemName) {
            yield InputBox({
                title: createItem === 'file' ? 'File name:' : 'Dir name:',
                cancelTitle: 'Cancel',
                onCancel: () => [setter('createItem').set(undefined)],
                onSuccess: name => [setter('itemName').set(name)],
                onWrongInput: () => resetCreateItem
            });
        }
        else if (createItem && itemName && currentDir) {
            yield message(`Create ${createItem} ${itemName} at ${normPath(vaultPath, openDir ?? '/')}?`);
            yield button('Yes', () => [
                resetCreateItem,
                createItem === 'file'
                    ? storeActions.newFile(currentDir.item, itemName)
                    : storeActions.newDir(currentDir.item, itemName),
            ]);
            yield button('No', () => resetCreateItem);
        }

        yield nextMessage();
    });
