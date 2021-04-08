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



export type AppDispatch<R = Promise<any>> = {
    onRedirect: (path: string) => R;
    onCard: (card: CardType) => R;
    onUpdatedTrainer: (trainer: TrainerState) => R;
    onUpdateWord: (word: WordEntityState, update: CardUpdate) => R;
    onReplaceWord: (word: WordEntityState, card: CardType) => R;
    onAddExample: (word: WordEntityState, example: string) => R;
    onDeleteWord: (word: WordEntityState) => R;
    onUpdateSettings: (settings: Partial<AppSettings>) => R;
    onToggleOption: (idx: number) => R;
    onTogglePinnedWord: (idx: number) => R;
};


export function storeToDispatch(store: ReturnType<typeof createAwadStore>): AppDispatch {
    return {
        onRedirect: async (path) => store.dispatch(redirect(path)),
        onCard: async (card) => {
            const userPayload = await store.dispatch(addWord(card));
            const user: UserEntity = userPayload.payload as UserEntity;
            const word = lastItem([...user.words].sort((a, b) => a.id - b.id));
            console.log(user.words.map(w => w.theword));
            store.dispatch(redirect(`/words?wordId=${word!.id}`));
        },
        onUpdatedTrainer: async (trainer) => store.dispatch(updateTrainer(trainer)),
        onUpdateWord: async (word, update) => store.dispatch(updateWord({ word, update })),
        onReplaceWord: async (word, card) => store.dispatch(saveWord({ word, card })),
        onAddExample: async (word, example) => store.dispatch(addExample({ word, example })),
        onDeleteWord: word => store.dispatch(deleteWord(word)),
        onUpdateSettings: async (settings) => store.dispatch(updateSettings(settings)),

        onToggleOption: async (idx) => store.dispatch(toggleIndex(idx)),
        onTogglePinnedWord: async (idx) => store.dispatch(togglePinnedWord(idx)),
    };
}
