import { UserEntity } from "../database/entity/user"
// import { Buttons, Message } from "../ui/chatui/elements"
import { WordEntity } from "../database/entity/word"
import { array, shuffle, parseCallbackData, takeRandom, takeLast } from "../bot/utils"
import { flattenList } from "../lib/util"
import { button, buttonsRow, message } from "../lib/helpers"
// import { TrainerCard, TrainerState } from "./state"
import { ComponentGenerator } from "../lib/types"
import { TrainerCard, TrainerState } from "./store/trainer"


export function* Trainer({ user, trainer, onUpdated, onRedirect }: {
    user: UserEntity,
    trainer: TrainerState,
    onRedirect: (path: string) => Promise<void>,
    onUpdated: (trainer: TrainerState) => Promise<void>
}) {

    const wordsWithMeanings = user.words.filter(_ => _.meanings.length)
    const wordsToTrain: WordEntity[] = takeRandom(wordsWithMeanings, 3)
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

    const cards = 
        [...takeLast(trainer.cards, 10), card]
        .map(card =>
            card.answer
                ? AnsweredTrainerCard(card)
                : QuestioningTrainerCard({
                    correctWord,
                    wrongs,
                    onCorrect: async () => {
                        await onUpdated({ ...trainer, cards: [...trainer.cards, {...card, answer: correctWord.id}] })
                    },
                    onWrong: async (wordId) => {
                        await onUpdated({ ...trainer, cards: [...trainer.cards,  {...card, answer: wordId}] })
                    },
                }))
        

    yield button('Stop training', async () => {
        await onRedirect('main')
        await onUpdated({ cards: [] })
    })

    for(const card of cards) {
        yield card
    }
}

export function* AnsweredTrainerCard({ correctWord, wrongs, answer }: TrainerCard): ComponentGenerator {
    yield message(
        [
            correctWord.meanings[0].description,
            ' - ',
            [correctWord, ...wrongs].find(_ => _.id == answer)!.theword,
            ' - ',
            correctWord.id == answer ? '👌 Correct' : '❌ Wrong'
        ].join('')
    )
}

export function* QuestioningTrainerCard({ correctWord, wrongs, answer, onCorrect, onWrong }:
    TrainerCard & {
        onCorrect(): Promise<void>,
        onWrong(wordId: number): Promise<void>,
    }): ComponentGenerator {

    const options = array(shuffle([...wrongs, correctWord]))
    yield message(correctWord.meanings[0].description)
    yield buttonsRow(
        options.map(_ => [_.theword, `answer_${_.id}`]),
        async (_, data) => {
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
}