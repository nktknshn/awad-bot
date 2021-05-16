import { pipe } from 'fp-ts/lib/pipeable';
import fs from 'fs/promises'
import { A, TE } from 'Lib/lib';
import path from "path";

// function printObsidianDir(d: ObsidianDir) {
//     console.log(d);
//     d.files.forEach(
//         f => f.kind === 'ObsidianFile' ? console.log(f) : printObsidianDir(f)
//     )
// }

const tasksArray = A.array.sequence(TE.taskEither)

function readdirRe1(dirPath: string) {
    return pipe(
        TE.tryCatch(() => readdirRe(dirPath), reason => ({
            message: `error opening ${dirPath}`
        }))
    )()
}

async function readdirRe(dirPath: string): Promise<ObsidianDir> {
    const items = await fs.readdir(dirPath)
    let files: ObsidianFile[] = []
    let dirs: ObsidianDir[] = []

    for (const file of items) {

        if (file.startsWith('.'))
            continue

        const fullPath = path.join(dirPath, file)
        const lstat = await fs.lstat(fullPath)

        if (lstat.isDirectory()) {
            dirs.push(await readdirRe(fullPath))
        }
        else {
            files.push({
                kind: 'ObsidianFile',
                name: file,
                path: fullPath,
                parentDirPath: path.dirname(fullPath),
                parentDirName: path.basename(path.dirname(fullPath))
            })
        }
    }

    return {
        kind: 'ObsidianDir',
        dirs,
        files,
        name: path.basename(dirPath),
        path: dirPath,
        parentDirPath: path.dirname(dirPath),
        parentDirName: path.basename(path.dirname(dirPath))
    }
}


type ObsidianFile = {
    kind: 'ObsidianFile',
    name: string,
    path: string,
    parentDirPath: string,
    parentDirName: string,
}

type ObsidianDir = {
    kind: 'ObsidianDir',
    name: string,
    path: string,
    parentDirPath: string,
    parentDirName: string,
    files: ObsidianFile[],
    dirs: ObsidianDir[],
}

type ObsidianVault = {
    kind: 'ObsidianDir',
    path: string,
    name: string,
    dirs: ObsidianDir[],
    files: ObsidianFile[],
    parentDirPath: string,
    parentDirName: string,
}

export const withIndex = <T>(items?: T[]) => items?.map((f, idx) => [f, idx] as const) ?? []
export const normPath = (vaultPath: string, p: string) => vaultPath == p ? '/' : p.replace(vaultPath + '/', '')
export const itemByPath = (p?: string) => <T extends { path: string, }>(items: T[]) => {
    const idx = items.findIndex(_ => _.path == p)

    return {
        idx: idx > -1 ? idx : undefined, item: idx > -1 ? items[idx] : undefined
    }
}

export const getVaultDirs = (vault: ObsidianVault) => vault.dirs
export const itemByUrl = (p: string) =>
    <T extends { path: string }>(vaultPath: string, items: T[]) =>
        {
            const idx = items.findIndex(_ => normPath(vaultPath, _.path).startsWith(p))
            return {idx: idx > -1 ? idx : undefined, item: idx > -1 ? items[idx] : undefined}
        }

function Vault(vault: ObsidianVault) {
    const dirByPath = (p?: string) => vault.dirs.find(_ => _.path == p)
    const dirsWithIndex = vault.dirs.map((f, idx) => [f, idx] as const)
    const filesWithIndex = (d?: ObsidianDir) => d?.files.map((f, idx) => [f, idx] as const) ?? []

    const normPath = (p: string) => p.replace(vault.path + '/', '')

    return {
        dirByPath,
        dirsWithIndex,
        normPath,
        filesWithIndex
    }
}

function vaultToStrings(v: ObsidianVault) {
    return [
        v.name
    ]
}

function dirToVault(d: ObsidianDir): ObsidianVault {

    function getFiles(dd: ObsidianDir): ObsidianFile[] {
        return A.flatten([dd.files, ...dd.dirs.map(getFiles)])
    }
    function getDirs(dd: ObsidianDir): ObsidianDir[] {
        return A.flatten(dd.dirs.map(_ => _.kind === 'ObsidianDir' ? [_, ...getDirs(_)] : []))
    }

    return {
        path: d.path,
        name: path.basename(d.path),
        files: getFiles(d),
        dirs: [d, ...getDirs(d)],
        kind: 'ObsidianDir',
        parentDirName: path.basename(path.dirname(d.path)),
        parentDirPath: path.dirname(d.path),
    }
}

export {
    dirToVault, ObsidianVault, ObsidianDir, ObsidianFile, readdirRe1, vaultToStrings, Vault
}