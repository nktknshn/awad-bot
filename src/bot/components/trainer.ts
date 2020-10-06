import { UserEntity } from "../../database/entity/user"
import { Buttons, Message } from "../ui/chatui/elements"
import { WordEntity } from "../../database/entity/word"
import { array, shuffle, parseCallbackData, takeRandom, takeLast } from "../utils"
import { Card } from "."
import { flattenList } from "../ui/util"
import { Callback, Element } from "../ui/chatui/types"

export interface TrainerCard {
    correctWord: WordEntity,
    wrongs: WordEntity[],
    answer?: number
}

export interface TrainerState {
    cards: TrainerCard[]
}

export function Trainer({ user, trainer, onUpdated, onRedirect }: {
    user: UserEntity,
    trainer: TrainerState,
    onRedirect: (path: string) => ReturnType<Callback>,
    onUpdated: (trainer: TrainerState) => ReturnType<Callback>
}): Element[] {

    const wordsWithMeanings = user.words.filter(_ => _.meanings.length)
    const wordsToTrain: WordEntity[] = takeRandom(wordsWithMeanings, 5)
    const meanings = wordsWithMeanings.map(_ => _.meanings)

    const correctWord = wordsToTrain[0]
    const otherWords = user.words.filter(_ => _.id != correctWord.id)

    const wrongs = takeRandom(otherWords, 3)

    // const options = array(shuffle([...wrongs, word]))

    const card: TrainerCard = (
        {
            correctWord,
            wrongs
        }
    )

    const cards = flattenList([...takeLast(trainer.cards, 3), card]
        .map(card =>
            card.answer
                ? AnsweredTrainerCard(card)
                : TrainerCard({
                    correctWord,
                    wrongs,
                    onCorrect: async () => {
                        card.answer = correctWord.id
                        await onUpdated({ ...trainer, cards: [...trainer.cards, card] })
                    },
                    onWrong: async (wordId) => {
                        card.answer = wordId
                        await onUpdated({ ...trainer, cards: [...trainer.cards, card] })
                    },
                })))

    return [
        Buttons(
            'Stop training',
            [[
                ['Stop training', 'stop']
            ]], async data => {
                if (data == 'stop') {
                    await onRedirect('main')
                    await onUpdated({ cards: [] })
                }
            }),
        ...cards
    ]
}

export function AnsweredTrainerCard({ correctWord, wrongs, answer }: TrainerCard): Element[] {
    return [
        Message(
            [
                correctWord.meanings[0].description,
                ' - ',
                [correctWord, ...wrongs].find(_ => _.id == answer)!.theword,
                ' - ',
                correctWord.id == answer ? '👌 Correct' : '❌ Wrong'
            ].join('')
        )
    ]
}

export function TrainerCard({ correctWord, wrongs, answer, onCorrect, onWrong }:
    TrainerCard & {
        onCorrect(): ReturnType<Callback>,
        onWrong(wordId: number): ReturnType<Callback>,
    }): Element[] {

    const options = array(shuffle([...wrongs, correctWord]))

    return [
        Buttons(
            correctWord.meanings[0].description,
            [
                options.map(_ => [_.theword, `answer_${_.id}`])
            ],
            async data => {
                if (!answer) {
                    const [_, wordId] = parseCallbackData(data)
                    if (wordId == correctWord.id) {
                        return await onCorrect()
                    } else {
                        return await onWrong(wordId)
                    }
                }
            }
        )
    ]
}