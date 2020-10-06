import { Markup } from "telegraf";

export function makeKeyboardRows(options: [string, string][][]) {
    return Markup.inlineKeyboard(
        options.map(row => row.map(([opt, data]) =>
            Markup.callbackButton(
                `${opt}`,
                data
            )))
    )
}

export function flattenList<T>(list_of_lists: T[][]): T[] {
    let result: T[] = []

    for (const list of list_of_lists) {
        // i use let because i change the value of the result
        result = [...result, ...list]
    }

    return result
}