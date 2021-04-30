import * as O from 'fp-ts/lib/Option'
import { pipe } from "fp-ts/lib/pipeable"
import { ParsedUrlQuery } from "node:querystring"
import { append } from "../bot3/util"
import { Component, connected } from "Lib/component"
import { routeMatcher, Router } from "Lib/components/router"
import { GetSetState, LocalStateAction } from "Lib/elements"
import { button, effect, message, messagePart, nextMessage } from "Lib/elements-constructors"
import { action, caseText, ifTrue, inputHandler, on } from "Lib/input"
import { StoreAction } from "Lib/storeF"
import { UserMessageElement } from "Lib/usermessage"
import { parsePathOpt, setDoFlush } from './util'
import { last, takeRight } from 'fp-ts/lib/Array'

export type StoreState = {
    lists: string[][]
}

export interface AppContext {
    userMessages: number[],
    store: {
        lists: string[][],
        addList: (list: string[]) => StoreAction<StoreState>;
        reset: () => StoreAction<StoreState>
    };
    userId: number
}

type RouterProps = {
    path: string, 
    query: ParsedUrlQuery,
    onDone: (list: string[]) => (StoreAction<StoreState> | LocalStateAction)[]
    onCancel: () => (StoreAction<StoreState> | LocalStateAction)[],
}

const AppRouter = Router(
    routeMatcher(
        (c: RouterProps) => c.path == '/main',
        ({ query }) => Greeting({ fromStart: 'from_start' in query })
    ),
    routeMatcher(
        c => c.path == '/set',
        ({ onDone, onCancel }) => Set({ onDone, onCancel })
    ),
    routeMatcher(
        c => c.path == '/get',
        () => Get({})
    ),
    Component(function* () {
        yield message('wrong input')
    })({})
)

export const App = connected(
    ({ store }: { store: AppContext['store'] }) => ({ store }),
    function* (
        { store }, _,
        { getState, setStateF }: GetSetState<{ path: string, query: ParsedUrlQuery }>
    ) {
        const {
            path, lenses: { path: pathLens, query: queryLens }
        } = getState({ path: '/main', query: {} })

        yield inputHandler([
            on(caseText,
                ifTrue(({ messageText }) => messageText.startsWith('/start')),
                action(_ => [
                    setStateF(pathLens.set('/main?from_start=1')),
                ])),
            on(caseText,
                action(({ messageText }) => [
                    setStateF(pathLens.set(messageText)),
                ])),
        ])

        const onDone = (list: string[]) => [
            store.addList(list),
            setStateF(pathLens.set('/get'))
        ]

        const onCancel = () => [setStateF(pathLens.set('/main'))]

        yield pipe(
            path,
            parsePathOpt,
            O.fold(
                () => AppRouter({ path: '/error', query: {}, onDone, onCancel }),
                props => AppRouter({ ...props, onDone, onCancel })
            )
        )
    }
)


const Greeting = connected(
    ({ userId }: { userId: number }) => ({ userId }),
    function* (ctx, {
        fromStart
    }: { fromStart: boolean }) {
        if (fromStart)
            yield messagePart(`Привет ${ctx.userId}`)

        yield messagePart('Комманды:')
        yield messagePart('/get')
        yield messagePart('/set')
        yield nextMessage()
    }
)

const Set = connected(
    ({ userMessages }: { userMessages: number[] }) => ({ userMessages }),
    function* (
        { userMessages },
        { onDone, onCancel }: {
            onDone: (list: string[]) => (StoreAction<StoreState> | LocalStateAction)[],
            onCancel: () => (StoreAction<StoreState> | LocalStateAction)[],
        },
        { getState, setStateF }: GetSetState<{
            list: string[]
        }>) {

        const { list, lenses } = getState({ list: [] })

        yield inputHandler([
            on(caseText, action(({ messageText }) =>
                setStateF(lenses.list.modify(append(messageText)))
            ))
        ])

        yield effect(() => setDoFlush(false))

        yield message('set here: ')

        for (const m of pipe(userMessages, takeRight(3))) {
            yield new UserMessageElement(m)
        }

        yield message(`list: ${list}`)
        yield button('Done', () => [onDone(list), setDoFlush(true)])
        yield button('Cancel', () => [onCancel(), setDoFlush(true)])
    })

const Get = connected(
    ({ store }: { store: AppContext['store'] }) => ({ lists: store.lists }),
    function* ({ lists }) {
        yield message('Your lists:')
        yield nextMessage()

        for (const list of lists) {
            for (const item of list) {
                yield messagePart(item)
            }
            yield nextMessage()
        }

        yield message('Go /main')
    })
