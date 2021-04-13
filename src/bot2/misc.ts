
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


// const createDraft = (getContext: () => AwadContextT) => (elements: AppElements[]): RenderDraft => {

//     const draft = emptyDraft()

//     // function handle(compel: AppElements) {
//     //     if (compel.kind == 'WithContext') {
//     //         handle(compel.f(getContext()))
//     //     }
//     //     else {
//     //         elementsToMessagesAndHandlers(compel, draft)
//     //     }
//     // }

//     for (const compel of elements) {
//         // handle(compel)
//     }

//     return draft
// }


// function contexted<Context>() {

//     type NthArg<T extends (...args: any) => any, N extends number> = Parameters<T>[N]

//     type Z = NthArg<typeof _input, 0>

//     const input = function (
//         callback: (ctx: Context) => NthArg<typeof _input, 0>
//     ) {
//         return new WithContext(
//             (ctx: Context) => _input(callback(ctx))
//         )
//     }

//     const button =
//         (
//             text: string,
//             callback: ((ctx: Context) => () => Promise<any>)
//         ) => new WithContext((ctx: Context) => button(text, callback(ctx)))

//     return {
//         input,
//         button
//     }
// }
