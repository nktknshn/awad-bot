import { UserEntity } from "../database/entity/user";
import { lastItem } from "../lib/util";
import { createAwadStore } from "./store";
import { toggleIndex } from "./store/misc";
import { redirect } from "./store/path";
import { updateSettings } from "./store/settings";
import { updateTrainer } from "./store/trainer";
import { addExample, addWord, deleteWord, saveWord, togglePinnedWord, updateWord } from "./store/user";
import { Card as CardType } from "../bot/interfaces";
import { CardUpdate } from "../bot/parsing";
import { AppSettings } from "./store/settings";
import { TrainerState } from "./store/trainer";
import { WordEntityState } from "./store/user";

export type AppDispatch = ReturnType<typeof storeToDispatch>

export function storeToDispatch(store: ReturnType<typeof createAwadStore>) {
    return {
        onRedirect: async (path: string) => { store.dispatch(redirect(path)) },
        onCard: async (card: CardType) => {
            const userPayload = await store.dispatch(addWord(card));
            const user: UserEntity = userPayload.payload as UserEntity;
            const word = lastItem([...user.words].sort((a, b) => a.id - b.id));
            // mylog(user.words.map(w => w.theword));
            store.dispatch(redirect(`/words?wordId=${word!.id}`));
        },
        onUpdatedTrainer: async (trainer: TrainerState) => { store.dispatch(updateTrainer(trainer)) },
        onUpdateWord: async (word: WordEntityState, update: CardUpdate) => { store.dispatch(updateWord({ word, update })) },
        onReplaceWord: async (word: WordEntityState, card: CardType) => { store.dispatch(saveWord({ word, card })) },
        onAddExample: async (word: WordEntityState, example: string) => { store.dispatch(addExample({ word, example })) },
        onDeleteWord: (word: WordEntityState) => { store.dispatch(deleteWord(word)) },
        onUpdateSettings: async (settings: Partial<AppSettings>) => { store.dispatch(updateSettings(settings)) },

        onToggleOption: async (idx: number) => { store.dispatch(toggleIndex(idx)) },
        onTogglePinnedWord: async (idx: number) => { store.dispatch(togglePinnedWord(idx)) },
    };
}

export type WithDispatcher<T = {}> = T & { dispatcher: AppDispatch }
