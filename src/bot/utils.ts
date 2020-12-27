import { WordEntity } from "../database/entity/word"

// now it works not only with a list of string but with any type
export function flattenList<T>(list_of_lists: T[][]): T[] {
    let result: T[] = []

    for (const list of list_of_lists) {
        // i use let because i change the value of the result
        result = [...result, ...list]
    }

    return result
}

export function getRandom<T>(items: T[]) {
    return items[Math.floor(Math.random() * items.length)]
}


export function* shuffle<T>(items: T[]) {
    const copy = [...items]

    while (copy.length) {
        const idx = Math.floor(Math.random() * copy.length)
        yield copy.splice(idx, 1)[0]
    }
}

export function* range(a: number, b: number) {
    while (a < b) {
        yield a++
    }
}

// export function range(a: number, b: number) {
//     return [...Array.from(Array(b - a).keys())].map(v => v + a)
// }

export function* take<T>(gen: Generator<T>, n: number) {
    for (const _ of Array.from(range(0, n))) {
        const { value, done } = gen.next()
        if (done)
            break
        yield value
    }
}

export function takeLast<T>(items: T[], n: number) {
    if(n > items.length)
        n = items.length

    return items.slice(items.length - n, items.length)
}

export function takeRandom<T>(items: T[], n: number) {
    return Array.from<T>(take(shuffle(items), n))
}

export function array<T>(it: Iterable<T>) {
    return Array.from<T>(it)
}

export function parseCallbackData(data: string) {
    const [cmd, n] = data.split('_')
    return [cmd, Number.parseInt(n)] as const
}

export function parseWordId(text: string) {
    if (text[0] != '/')
        return

    if (text[1] == 'w' && text[2] == '_') {
        const id = Number.parseInt(text.slice(3))
        return ['w', id] as const
    }

}