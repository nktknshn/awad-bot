import * as T from 'fp-ts/Task'
import * as R from 'fp-ts/lib/Reader'
import { pipe } from 'fp-ts/lib/pipeable'
import * as S from 'fp-ts/lib/State'

// declare const main: T.Task<void>

function main() {

    interface Deps {
        a: number,
        b: string
    }

    interface State {
        sum: number
    }

    const f = (name: String): R.Reader<Deps, void> => deps => {
        console.log(`${name} ${deps}`);
    }

    const g = (): R.Reader<Deps, void> =>
        pipe(
            R.ask<Deps>(),
            R.chain(deps => f(deps.b))
        )
    
    g()({a: 1, b: "aa"})
}


main()