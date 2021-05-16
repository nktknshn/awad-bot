import { connected } from "Lib/component";
import { messagePart } from "Lib/elements-constructors";
import { select } from "Lib/state";
import path from "path";
import { getVaultPath, getOpenFile, getStoreActions, getFiles } from '../selectors';
import { itemByPath, normPath, ObsidianDir } from "../obs";
import { boldify, italify } from "../util";


export const VaultOpenDirFiles = connected(
    select(getFiles, getVaultPath, getOpenFile, getStoreActions),
    function* ({ files, vaultPath, openFile }, { dir }: { dir: ObsidianDir; }) {

        for (const f of dir.files) {
            const { idx } = itemByPath(f.path)(files) ?? {};

            const title = boldify(
                _ => openFile == f.path,
                italify(_ => false, path.basename(normPath(vaultPath, f.path))
                    .replace('.md', '')));

            yield messagePart(`/file_${idx}            ${title}`);
        }
    });
