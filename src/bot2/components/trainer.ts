import { array, parseCallbackData, shuffle, takeLast, takeRandom } from "../../bot/utils"
import { connected1, connected2, Component } from "../../lib/elements"
import { button, buttonsRow, message } from "../../lib/elements-constructors"
import { select } from "../../lib/state"
import { getTrainer, getUser } from "../store/selectors"
import { TrainerCard, TrainerState } from "../store/trainer"
import { UserEntityState, WordEntityState } from "../store/user"

//             yield ConnectedComp(Trainer, combine(getTrainer, getUser))
// ({ onRedirect: dispatcher.onRedirect, onUpdated: dispatcher.onUpdatedTrainer })
export const Trainer =
  connected2(
    select(getUser, getTrainer),
    ({ user, trainer }) =>
      function* ({ onRedirect, onUpdated }: {
        onRedirect: (path: string) => Promise<void>,
        onUpdated: (trainer: TrainerState) => Promise<void>
      }) {
        if (!user)
          return

        const wordsWithMeanings = user.words.filter(_ => _.meanings.length)
        const wordsToTrain: WordEntityState[] = takeRandom(wordsWithMeanings, 3)
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
          [...takeLast(trainer.cards, 5), card]
            .map(card =>
              card.answer
                ? Component(AnsweredTrainerCard)(card)
                : Component(QuestioningTrainerCard)({
                  correctWord,
                  wrongs,
                  onCorrect: async () => {
                    await onUpdated({ ...trainer, cards: [...trainer.cards, { ...card, answer: correctWord.id }] })
                  },
                  onWrong: async (wordId) => {
                    await onUpdated({ ...trainer, cards: [...trainer.cards, { ...card, answer: wordId }] })
                  },
                }))


        yield button('Stop training', async () => {
          await onRedirect('main')
          await onUpdated({ cards: [] })
        })

        for (const card of cards) {
          yield card
        }
      }
  )

export function* AnsweredTrainerCard({ correctWord, wrongs, answer }: TrainerCard) {
  yield message(
    [
      correctWord.id == answer ? '👌 Correct' : '❌ Wrong',
      ' ',
      correctWord.meanings[0].description,
      ' - ',
      [correctWord, ...wrongs].find(_ => _.id == answer)!.theword,
    ].join('')
  )
}

export function* QuestioningTrainerCard({ correctWord, wrongs, answer, onCorrect, onWrong }:
  TrainerCard & {
    onCorrect(): Promise<void>,
    onWrong(wordId: number): Promise<void>,
  }) {

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