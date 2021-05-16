import { flow } from "fp-ts/lib/function";
import { createSelector } from 'reselect';
import { itemByPath, ObsidianVault } from "./obs";
import { storeActions } from './store';

const getVault = ({ vault }: { vault: ObsidianVault; }) => ({ vault });
export const getDirs = flow(getVault, c => ({ dirs: c.vault.dirs }));
export const getFiles = flow(getVault, c => ({ files: c.vault.files }));
export const getVaultPath = flow(getVault, c => ({ vaultPath: c.vault.path }));
export const getOpenDir = ({ openDir }: { openDir?: string; }) => ({ openDir });
export const getOpenFile = ({ openFile }: { openFile?: string; }) => ({ openFile });
export const getStoreActions = ({ storeActions }: WithStoreActions) => ({ storeActions });
export const getExpandedDirs = ({ expandedDirs }: {expandedDirs: string[]}) => ({ expandedDirs });
export const getOpenFileContent = ({ openFileContent }: { openFileContent?: string; }) => ({ openFileContent });
type WithStoreActions = Record<'storeActions', ReturnType<typeof storeActions>>;
export const getCurrentDir = createSelector(
    getOpenDir, getDirs,
    ({ openDir }, { dirs }) => ({ currentDir: itemByPath(openDir)(dirs) })
);
export const getVaultName = createSelector(
    getVault,
    v => ({ vaultName: v.vault.name })
);
