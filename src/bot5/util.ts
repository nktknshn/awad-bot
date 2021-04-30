import * as O from 'fp-ts/lib/Option'
import { pipe } from "fp-ts/lib/pipeable"
import { parsePath } from '../lib/util'

export const setDoFlush = (doFlush: boolean) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { doFlush: boolean }>(s: R) =>
        ({ ...s, doFlush })
})

export const setBufferEnabled = (bufferedInputEnabled: boolean) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { bufferedInputEnabled: boolean }>(s: R) =>
        ({ ...s, bufferedInputEnabled })
})


export const parsePathOpt = (path: string) => pipe(
    parsePath(path),
    ({ pathname, query }) =>
        pipe(O.fromNullable(pathname), O.map(
            path => ({
                path,
                query: pipe(O.fromNullable(query), O.fold(() => ({}), q => ({ ...q }))),
            })))
)
