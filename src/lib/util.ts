import * as url from 'url'
import * as querystring from 'querystring'
import { replicate } from 'fp-ts/Array'
import { none, some } from 'fp-ts/lib/Option'
import { InputHandler, InputHandlerData } from './messages'

type Piper<T,
    A extends keyof T,
    B extends keyof T = never,
    C extends keyof T = never,
    D extends keyof T = never,
    E extends keyof T = never,
    F extends keyof T = never,
    G extends keyof T = never,
    H extends keyof T = never,
    I extends keyof T = never,
    > = A | B | C | D | E | F | G | H | I

export type Getter<T,
    A extends keyof T,
    B extends keyof T = never,
    C extends keyof T = never,
    D extends keyof T = never,
    E extends keyof T = never,
    F extends keyof T = never,
    G extends keyof T = never,
    H extends keyof T = never,
    I extends keyof T = never,
    > = Pick<T, Piper<T, A, B, C, D, E, F, G, H, I>>

export const emptyMessage = '🐻'

export function randomItem<T>(items: T[]) {
    return items[Math.floor(Math.random() * items.length)];
}

export function enumerateListOfLists<T>(list: T[][]) {
    let idx = 0
    let result = []
    for (const row of list) {
        const a: [T, number][] = []
        for (const item of row) {
            a.push([item, idx])
            idx += 1
        }
        result.push(a)
    }
    return result
}

export function randomAnimal() {
    return randomItem(
        ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐚", "🐞", "🐜", "🕷", "🕸", "🐢", "🐍", "🦎", "🦂", "🦀", "🦑", "🐙", "🦐", "🐠", "🐟", "🐡", "🐬", "🦈", "🐳", "🐋", "🐊", "🐆", "🐅", "🐃", "🐂", "🐄", "🦌", "🐪", "🐫", "🐘", "🦏", "🦍", "🐎", "🐖", "🐐", "🐏", "🐑", "🐕", "🐩", "🐈", "🐓", "🦃", "🕊", "🐇", "🐁", "🐀", "🐿", "🐾", "🐉", "🐲", "🌵", "🎄", "🌲", "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🎍", "🎋", "🍃", "🍂", "🍁", "🍄", "🌾", "💐", "🌷", "🌹", "🥀", "🌻", "🌼", "🌸", "🌺", "🌎", "🌍", "🌏", "🌕", "🌖", "🌗", "🌘", "🌑", "🌒", "🌓", "🌔", "🌚", "🌝", "🌞", "🌛", "🌜", "🌙", "💫", "⭐️", "🌟", "✨", "⚡️", "🔥", "💥", "☄", "☀️", "🌤", "⛅️", "🌥", "🌦", "🌈", "☁️", "🌧", "⛈", "🌩", "🌨", "☃️", "⛄️", "❄️", "🌬", "💨", "🌪", "🌫", "🌊", "💧", "💦", "☔️", "🦓", "🦒", "🦔", "🦕", "🦖"]
    )
}

export type PathQuery = querystring.ParsedUrlQuery

export function parsePath(pathString: string) {
    const { pathname, query } = url.parse(pathString)

    return {
        pathname,
        query: query ? querystring.parse(query) : undefined
    }
}

export function ordDate(ord: 'asc' | 'desc' = 'asc') {
    return function (a: Date, b: Date) {
        if (ord == 'asc')
            return a.getTime() - b.getTime()
        else
            return b.getTime() - a.getTime()
    }
}

export function formatDate(d: Date) {
    return `${d.getDate()}.${d.getMonth()} ${d.getHours()}:${d.getMinutes()}`
}

export function flattenList<T>(list_of_lists: T[][]): T[] {
    let result: T[] = []

    for (const list of list_of_lists) {
        // i use let because i change the value of the result
        result = [...result, ...list]
    }

    return result
}

export function zip<A, B>(as: A[], bs: B[]): [(A | undefined), (B | undefined)][] {
    const len = Math.max(as.length, bs.length)

    const result: [(A | undefined), (B | undefined)][] = []

    for (let i = 0; i < len; i++) {
        result.push([as[i], bs[i]])
    }

    return result
}

export function lastItem<T>(items: T[]) {
    if (items.length) {
        return items[items.length - 1]
    }
}

export function pairs<T>(items: T[]) {
    const items2 = [...items, undefined]

    return zip(items, items2)
}
export function* range(a: number, b: number) {
    while (a < b) {
        yield a++
    }
}
export function enumerate<T>(items: T[]): [number, T][] {

    return zip([...range(0, items.length)], items) as [number, T][]
}

// export function filterInstances<T>(list: (T | any)[]): T[] {
//     return list.filter(_ => _ instanceof T)
// }

export function textColumns(col1: string[], col2: string[], col1Width = 20): string[] {

    // const col1Width = 30
    // const col2Width = 30

    let result = []

    for (const [text1, text2] of zip(col1, col2)) {
        result.push(
            [
                text1 ?? '',
                replicate(col1Width - (text1?.length ?? 0), '.').join(''),
                text2 ?? ''
            ].join(''))
    }

    return result
}

export function partitate<T>(
    items: T[],
    predicate: (v: T) => boolean
) {
    let left = []
    let right = []

    for (const v of items) {
        if (predicate(v))
            left.push(v)
        else
            right.push(v)
    }

    return [left, right] as const
}

// export function contains() {
// 
// }

export function toggleItem<T>(items: T[], item: T) {
    const _items = [...items]

    const idx = _items.indexOf(item)

    if(idx > -1) {
        _items.splice(idx, 1)
    } else {
        _items.push(item)
    }

    return _items
}


export const tryKey = (key: string, query?: querystring.ParsedUrlQuery) =>
    (query && key in query && query[key] !== undefined) ? some(query[key]) : none

export const isFalse = (v: any): v is false => typeof v === 'boolean' && v == false
export const isTrue = (v: any): v is true => typeof v === 'boolean' && v == true

export const nspaces = (n: number, s = ' ') => [...range(0, n)].map(_ => s).join('')

export async function callHandlersChain(
    inputHandlers: InputHandler[],
    data: InputHandlerData,
    idx: number = 0,
): Promise<void | boolean> {

    console.log(`callHandler(${idx})`);

    if (idx > inputHandlers.length - 1)
        return

    return inputHandlers[idx].callback(
        data,
        () => callHandlersChain(inputHandlers, data, idx + 1)
    )
}