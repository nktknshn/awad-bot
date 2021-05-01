import * as O from 'fp-ts/lib/Option'
import { pipe } from "fp-ts/lib/pipeable"
import { parsePath } from '../lib/util'

export const parsePathOpt = (path: string) => pipe(
    parsePath(path),
    ({ pathname, query }) =>
        pipe(O.fromNullable(pathname), O.map(
            path => ({
                path,
                query: pipe(O.fromNullable(query), O.fold(() => ({}), q => ({ ...q }))),
            })))
)
