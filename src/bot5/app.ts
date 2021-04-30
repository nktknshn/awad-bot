import * as O from 'fp-ts/lib/Option'
import { pipe } from "fp-ts/lib/pipeable"
import { ParsedUrlQuery } from "node:querystring"
import { append, deferRender } from "../bot3/util"
import { Component, connected } from "Lib/component"
import { routeMatcher, Router } from "Lib/components/router"
import { GetSetState, LocalStateAction } from "Lib/elements"
import { button, effect, message, messagePart, nextMessage } from "Lib/elements-constructors"
import { action, caseText, ifTrue, inputHandler, on } from "Lib/input"
import { StoreAction } from "Lib/storeF"
import { userMessage, UserMessageElement } from "Lib/usermessage"
import { parsePathOpt, setBufferEnabled, setDoFlush } from './util'
import { last, takeRight } from 'fp-ts/lib/Array'
import { combineSelectors, select } from "Lib/state"
import { Context, StoreState } from 'bot5/index'
import { flow } from 'fp-ts/lib/function'

const getUserMessages = ({ userMessages }: { userMessages: number[] }) => ({ userMessages })
const getStore = ({ store }: { store: Context['store'] }) => ({ store })
const getAddList = flow(getStore, ({ store }) => ({ addList: store.actions.addList }))
const getLists = flow(getStore, ({ store }) => ({ lists: store.state.lists }))
const getUserId = ({ userId }: { userId: number }) => ({ userId })

export const App = connected(
    select(getAddList),
    function* (
        { addList }, _,
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
            addList(list),
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
        // yield effect(onCancel)
    })({})
)

const Greeting = connected(
    select(getUserId),
    function* (
        { userId },
        { fromStart }: { fromStart: boolean }) {

        if (fromStart)
            yield messagePart(`Привет ${userId}`)

        yield messagePart('Комманды:')
        yield messagePart('/get')
        yield messagePart('/set')
        yield nextMessage()
    }
)

const Set = connected(
    select(getUserMessages),
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
                [
                    setStateF(lenses.list.modify(append(messageText)))
                    ,...[list.length == 0 ? [setBufferEnabled(true), deferRender(3000)]: []]
                ]
            ))
        ])

        yield effect(() => [setDoFlush(false)])

        if (list.length) {
            yield message('type your list: ')

            for (const m of pipe(userMessages, takeRight(10))) {
                yield userMessage(m)
            }

            yield message(`list: ${list}`)
            yield button('Done', () => [onDone(list), setDoFlush(true), deferRender(0), setBufferEnabled(false)])
            yield button('Cancel', () => [onCancel(), setDoFlush(true), deferRender(0), setBufferEnabled(false)])
        }
        else {
            yield message(`start typing:`)
            yield button('Cancel', () => [onCancel(), setDoFlush(true)])

        }
    })

const Get = connected(
    select(getLists),
    function* ({ lists }) {
        yield message('Your lists:')
        yield nextMessage()

        for (const list of lists) {
            for (const item of list) {
                yield messagePart(item)
            }
            yield nextMessage()
        }

        yield message([
            'Go /main',
            'Or /set more'
        ])
    })
