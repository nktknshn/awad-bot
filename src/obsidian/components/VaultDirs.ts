import { connected } from "Lib/component";
import { button, messagePart, nextMessage } from "Lib/elements-constructors";
import { message } from 'Lib/lib';
import { select } from "Lib/state";
import { GetSetState } from "Lib/tree2";
import { getCurrentDir, getDirs, getVaultPath, getOpenDir, getOpenFile, getStoreActions, getHidden } from '../selectors';
import { itemByPath, normPath, withIndex } from "../obs";
import { boldify, brailleSymbol } from "../util";
import { InputBox } from './InputBox';
import { VaultOpenDirFiles } from "./VaultOpenDirFiles";
import { pipe } from "fp-ts/lib/pipeable";

export const VaultDirs = connected(
    select(
        getCurrentDir, getDirs, getVaultPath, getOpenDir, getOpenFile, getStoreActions, getHidden
    ),
    function* ({ dirs, openDir, vaultPath, storeActions, openFile, hidden, currentDir },
        { showEmpty, expandedDirs, showDirLinks }: { showDirLinks: boolean, showEmpty: boolean; expandedDirs: string[]; },
        { set, getState }: GetSetState<{
            createItem?: 'file' | 'dir';
            itemName?: string;
        }>
    ) {
        const { createItem, itemName } = getState({});

        const resetCreateItem = [
            set('createItem')(undefined),
            set('itemName')(undefined)
        ];

        yield nextMessage();

        for (const [d, idx] of withIndex(dirs)) {

            if (!showEmpty && d.files.length == 0)
                continue;
            if (hidden.includes(d.path))
                continue

            const isCurrent = openDir == d.path

            const name = pipe(
                normPath(vaultPath, d.path)
                , name => isCurrent ? `[${name}]` : name
            );

            const isRoot = name == '/'

            const title =
                d.files.length
                    ? `<code>${name}</code>`
                    : `${name} <code>(empty)</code>`;

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
            yield button(`New file`, () => set('createItem')('file'));
            yield button(`New dir`, () => set('createItem')('dir'));
        }

        if (createItem && !itemName) {
            yield InputBox({
                title: createItem === 'file' ? 'File name:' : 'Dir name:',
                cancelTitle: 'Cancel',
                onCancel: () => [set('createItem')(undefined)],
                onSuccess: name => [set('itemName')(name)],
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
