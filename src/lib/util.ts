import * as url from 'url'
import * as querystring from 'querystring'
import { replicate } from 'fp-ts/Array'

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
