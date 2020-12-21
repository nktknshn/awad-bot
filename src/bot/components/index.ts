import { WordEntity } from "../../database/entity/word"
import { UserEntity } from "../../database/entity/user"
import { Message } from "../ui/chatui/elements"
import { makeCardText } from "../parsing"

export function WordsListMessage(props: { words: WordEntity[] }) {
    return [
        Message(
            props.words.sort((a, b) => a.theword.localeCompare(b.theword)).map(
                w => `${w.theword}\t/w_${w.id}`
            ).join('\n'))
    ]
}

export function Statistics(props: { user: UserEntity }) {
    return [
        Message(`Words: ${props.user.words.length}`)
    ]
}

export function Card(props: { word: WordEntity }) {
    return [
        Message(makeCardText(props.word))
    ]
}