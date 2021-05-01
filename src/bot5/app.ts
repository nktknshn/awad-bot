import * as O from 'fp-ts/lib/Option'
import { pipe } from "fp-ts/lib/pipeable"
import { ParsedUrlQuery } from "node:querystring"
import { append, deferRender } from "../bot3/util"
import { Component, connected } from "Lib/component"
import { routeMatcher, Router } from "Lib/components/router"
import { button, effect, message, messagePart, nextMessage } from "Lib/elements-constructors"
import { action, caseText, ifTrue, inputHandler, nextHandler, on } from "Lib/input"
import { StoreAction } from "Lib/storeF"
import { userMessage, UserMessageElement } from "Lib/usermessage"
import { parsePathOpt } from './util'
import { setBufferedInputEnabled, setDoFlush } from "./actions"
import { last, takeRight } from 'fp-ts/lib/Array'
import { combineSelectors, select } from "Lib/state"
import { Context, StoreState } from 'bot5/index'
import { flow } from 'fp-ts/lib/function'
import { GetSetState, LocalStateAction } from 'Lib/tree2'
import { Form1 } from './components/form'

const getUserMessages = ({ userMessages }: { userMessages: number[] }) => ({ userMessages })
const getStore = ({ store }: { store: Context['store'] }) => ({ store })
const getAddList = flow(getStore, ({ store }) => ({ addList: store.actions.addList }))
const getLists = flow(getStore, ({ store }) => ({ lists: store.state.lists }))
const getUserId = ({ userId }: { userId: number }) => ({ userId })

export const App = connected(
    select(getAddList),
    function* (
        { addList }, _,
        { getState, setState }: GetSetState<{ path: string, query: ParsedUrlQuery }>
    ) {
        const {
            path, lenses: { path: pathLens, query: queryLens }
        } = getState({ path: '/main', query: {} })

        yield inputHandler([
            on(caseText,
                ifTrue(({ messageText }) => messageText.startsWith('/start')),
                action(_ => [
                    setState(pathLens.set('/main?from_start=1')),
                ])),
            on(caseText,
                action(({ messageText }) => [
                    setState(pathLens.set(messageText)),
                ])),
        ])

        const onDone = (list: string[]) => [
            addList(list),
            setState(pathLens.set('/get'))
        ]

        const onCancel = () => [setState(pathLens.set('/main'))]

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

type RouterProps<R> = {
    path: string,
    query: ParsedUrlQuery,
    onDone: (list: string[]) => R
    onCancel: () => R,
}

const AppRouter = Router(
    routeMatcher(
        <R>(c: RouterProps<R>) => c.path == '/main',
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
    routeMatcher(
        c => c.path == '/form',
        ({ onCancel }) => Form1({ onCancel })
    ),
    Component(function* () {
        yield message('wrong input')
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
        yield messagePart('/form')
        yield nextMessage()
    }
)

const Set = connected(
    select(getUserMessages),
    function* <R>(
        { userMessages }: { userMessages: number[] },
        { onDone, onCancel }: {
            onDone: (list: string[]) => R,
            onCancel: () => R,
        },
        { getState, setState }: GetSetState<{
            list: string[]
        }>) {

        yield effect(() => [setDoFlush(false)], 'OnCreated')
        yield effect(() => [setDoFlush(true), setBufferedInputEnabled(false)], 'OnRemoved')

        const { list, lenses } = getState({ list: [] })

        // yield inputHandler([
        //     on(caseText,
        //         action(({ messageText }) => setStateF(lenses.list.modify(append(messageText)))))
        // ])

        // yield inputHandler([
        //     on(caseText, ifTrue(_ => list.length == 0),
        //         action(() => [setBufferedInputEnabled(true)])),
        // ])

        yield inputHandler([
            on(caseText, ifTrue(_ => list.length == 0),
                action(({ messageText }) => [
                    setState(lenses.list.modify(append(messageText))),
                    setBufferedInputEnabled(true)
                ])),
            on(caseText,
                action(({ messageText }) => setState(
                    lenses.list.modify(append(messageText)))))
        ])

        if (list.length) {
            yield message('type your list: ')

            for (const m of pipe(userMessages, takeRight(5))) {
                yield userMessage(m)
            }

            yield message(`list: ${list}`)
            yield button('Done', () => [onDone(list)])
            yield button('Cancel', onCancel)
        }
        else {
            yield message(`start typing:`)
            yield button('Cancel', onCancel)

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
