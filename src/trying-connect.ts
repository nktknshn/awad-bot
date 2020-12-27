import { RootState } from "./bot2/store"
import { messagePart, nextMessage } from "./lib/constructors"
import { CompConstructorWithState, Component, ComponentConnected, Subtract } from "./lib/types"

function selector<S, P = unknown>(func: (state: S) => P) {
    return func
    // return {
    //     kind: 'selector',
    //     apply: function (state: S) {
    //         return func(state)
    //     }
    // }
}

const selectUser = ({ user }: RootState) => user

const getUser = selector(({ user }: RootState) => ({ user }))
const getWordsTitles = selector(({ user }: RootState) =>
    ({ wordsTitles: user ? user.words.map(_ => _.theword) : [] }))

type Component1Props = {
    wordsTitles: string[]
    n: number
}

function* Component1({ wordsTitles }: Component1Props) {
    yield nextMessage()
    for (const title of wordsTitles) {
        yield messagePart(title)
    }
    yield nextMessage()
}

const comp1 = Component(Component1)

// const connectedComp1 = (state: RootState) => comp1(getWordsTitles(state))


function ConnectedComp<P extends M, S, M, State>(
    cons: CompConstructorWithState<P, S>,
    mapper: (state: State) => M,
): (props: Subtract<P, M>) => ComponentConnected<P, S, M, State> {
    return function (props: Subtract<P, M>): ComponentConnected<P, S, M, State> {
        return {
            cons,
            props,
            mapper,
            kind: 'component-with-state-connected'
        }
    }
}

const aaa = ConnectedComp(Component1, getWordsTitles)

const a = ConnectedComp(Component1, getWordsTitles)({n: 100})
