import { button, input, message, messagePart } from "../elements-constructors"
import { Component } from "../component"
import { enumerate, partitate, textColumns, toggleItem } from "../util"
import { action, caseText, inputHandler, nextHandler, on } from "../input"
import { GetSetState } from "Lib/tree2"

type OnClick<T,R> = { onClick: (arg: T) => R }
type OnUpdate<T,R> = { onUpdate: (arg: T) => R }


export type CheckListProps = {
    items: string[],
}

export const CheckListStateless =
    Component(function* CheckListStateless<R>({
        items, selectedIds, onClick
    }: {
        items: string[],
        selectedIds: number[]
    } & OnClick<number, R>) {
        yield Component(CheckListInput)({ items, selectedIds, onClick })
        yield Component(CheckListBody)({ items, selectedIds })
    })

export function* CheckList(
    {
        items, onClick, onUpdate
    }: CheckListProps & OnClick<number[], any> & OnUpdate<number[], any>,
    { getState, setState, lenses }: GetSetState<{
        selectedIds: number[]
    }>
) {
    const { selectedIds , } = getState({ selectedIds: [] })

    yield Component(CheckListInput)({
        items, selectedIds, onClick: async (id) => {
            setState(lenses('selectedIds').set(toggleItem(selectedIds, id)))
        }
    })
    yield Component(CheckListBody)({ items, selectedIds })
    yield button('Confirm', () => onClick(selectedIds))
}


export function* CheckListInput<R>({
    items,
    onClick
}: CheckListProps & OnClick<number, R> & { selectedIds: number[] }) {
    yield inputHandler([
        on(caseText, action(({ messageText }) => {
            const p = parseCommandAndId(messageText) 
            if (p) {
                const [cmd, id] = p
                if (cmd == 'opt') {
                    return onClick(id)
                }
            }
            
            return nextHandler()
        }))
    ])

    // async ({ messageText }, next) => {
    //     if (messageText) {
    //         const p = parseCommandAndId(messageText)
    //         if (p) {
    //             const [cmd, id] = p
    //             if (cmd == 'opt') {
    //                 await onClick(id)
    //                 return
    //             }
    //         }
    //     }

    //     return await next()
    // }
}

function codeRow(string1: string, string2: string, length: number = 20) {
    return `<code>${textColumns([string1], [`</code>${string2}`], length)}`
}


export function* CheckListBody({
    items,
    selectedIds = []
}: CheckListProps & { selectedIds: number[] }) {

    const [selected, other] = partitate(
        enumerate(items),
        ([idx, _]) => selectedIds.indexOf(idx) > -1
    )

    yield messagePart(`Selected:`)
    yield messagePart(``)

    for (const [idx, item] of selected) {
        yield messagePart(codeRow(item, `/opt_${idx}`, 20))
    }

    yield messagePart(``)
    yield messagePart(`Not selected:`)
    yield messagePart(``)

    for (const [idx, item] of other) {
        yield messagePart(codeRow(item, `/opt_${idx}`, 20))
        // yield messagePart(`${item}     /opt_${idx}`)
    }
}

function parseCommandAndId(text: string) {
    const parsed = text.slice(1).split('_')

    if (parsed.length != 2)
        return

    const [cmd, id] = parsed

    const int = Number.parseInt(id)

    if (int === null)
        return

    return [cmd, int] as const
}
