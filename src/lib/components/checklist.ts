import { button, input, message, messagePart } from "../helpers"
import { Component, GetSetState } from "../types"
import { enumerate, partitate, toggleItem } from "../util"

type OnClick<T> = { onClick: (arg: T) => Promise<void> }
type OnUpdate<T> = { onUpdate: (arg: T) => Promise<void> }


export type CheckListProps = {
    items: string[],
}

export function* CheckListStateless({
    items, selectedIds, onClick
}: {
    items: string[],
    selectedIds: number[]
} & OnClick<number>) {
    yield Component(CheckListInput)({ items, selectedIds, onClick })
    yield Component(CheckListBody)({ items, selectedIds })
    // yield button('Confirm', () => onClick(selectedIds))
}

export function* CheckList(
    {
        items, onClick, onUpdate
    }: CheckListProps & OnClick<number[]> & OnUpdate<number[]>,
    { getState, setState }: GetSetState<{
        selectedIds: number[]
    }>
) {
    const { selectedIds } = getState({ selectedIds: [] })

    yield Component(CheckListInput)({
        items, selectedIds, onClick: async (id) => {
            setState({
                selectedIds: toggleItem(selectedIds, id)
            })
        }
    })
    yield Component(CheckListBody)({ items, selectedIds })
    yield button('Confirm', () => onClick(selectedIds))
}



export function* CheckListInput({
    items,
    onClick
}: CheckListProps & OnClick<number> & { selectedIds: number[] }) {
    yield input(async ({ messageText }, next) => {
        if (messageText) {
            const p = parseCommandAndId(messageText)
            if (p) {
                const [cmd, id] = p
                if (cmd == 'opt') {
                    await onClick(id)
                    return
                }
            }
        }

        return await next()
    })
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
        yield messagePart(`${item}     /opt_${idx}`)
    }

    yield messagePart(``)
    yield messagePart(`Not selected:`)
    yield messagePart(``)

    for (const [idx, item] of other) {
        yield messagePart(`${item}     /opt_${idx}`)
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
