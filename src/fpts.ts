import * as T from 'fp-ts/Task'
import * as R from 'fp-ts/lib/Reader'
import { pipe } from 'fp-ts/lib/pipeable'
import * as S from 'fp-ts/lib/State'
import { sequenceT } from 'fp-ts/lib/Apply'
import { sequenceS } from 'fp-ts/lib/Apply'


function doState(): S.State<{ s: string }, void> {
    return S.chain(
        S.get,
        (s) => {}
    )
}

function main() {

    interface Deps {
        a: number,
        b: string
    }

    interface State {
        sum: number
    }

    S.state

    const f = (name: String): R.Reader<Deps, void> => deps => {
        mylog(`${name} ${deps}`);
    }

    const g = (): R.Reader<Deps, void> =>
        pipe(
            R.ask<Deps>(),
            R.chain(deps => f(deps.b))
        )

    g()({ a: 1, b: "aa" })
}


main()