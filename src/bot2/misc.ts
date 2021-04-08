
// type AwadStore = ReturnType<typeof createAwadStore>
// type M<T extends AppDispatch> = { [K in keyof AppDispatch]: (...args: Parameters<T[K]>) => (store: AwadStore) => ReturnType<T[K]> }

// export const storeToDispatch2: M<AppDispatch> = {
//     onRedirect: path => async store => store.dispatch(redirect(path)),
//     onCard: card => async store => {
//         const userPayload = await store.dispatch(addWord(card))
//         const user: UserEntity = userPayload.payload as UserEntity
//         const word = lastItem([...user.words].sort((a, b) => a.id - b.id))
//         console.log(user.words.map(w => w.theword));
//         store.dispatch(redirect(`/words?wordId=${word!.id}`))
//     },
//     onUpdatedTrainer: trainer => async store =>
//         store.dispatch(updateTrainer(trainer)),
//     onUpdateWord: (word, update) => async store =>
//         store.dispatch(updateWord({ word, update })),
//     onReplaceWord: (word, card) => async store =>
//         store.dispatch(saveWord({ word, card })),
//     onAddExample: (word, example) => async store =>
//         store.dispatch(addExample({ word, example })),
//     onDeleteWord: word => async store => store.dispatch(deleteWord(word)),
//     onUpdateSettings: settings => async store => store.dispatch(updateSettings(settings)),
//     onToggleOption: idx => async store => store.dispatch(toggleIndex(idx)),
//     onTogglePinnedWord: idx => async store => store.dispatch(togglePinnedWord(idx)),
// }