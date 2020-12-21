import { input, message, messagePart } from "../helpers"
import { enumerate, partitate } from "../util"

export function* CheckList({
    items,
    onClick,
    selectedIds = []
}: CheckListProps & OnClick<number>) {
    yield CheckListInput({ items, selectedIds, onClick })
    yield CheckListBody({ items, selectedIds })
}

export type CheckListProps = {
    items: string[],
    selectedIds: number[]
}

type OnClick<T> = { onClick: (arg: T) => Promise<void> }

export function* CheckListInput({
    items,
    onClick
}: CheckListProps & OnClick<number>) {
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
}: CheckListProps) {

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
