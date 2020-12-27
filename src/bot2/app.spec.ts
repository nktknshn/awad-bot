// import { range } from "../bot/utils";
// import { UserEntity } from "../database/entity/user";
// import { WordEntity } from "../database/entity/word";
// import { ComponentGenerator, isGenerator, SimpleElement } from "../lib/types";
// import { zip } from "../lib/util";
// import { App } from "./app";
// import { WordsList } from "./components/WordsList";
// import { currentComponent } from "./mystore/state";


// function word(dto: Partial<WordEntity>) {
//     const entity = new WordEntity()

//     for (const key of Object.keys(dto)) {
//         if ((<any>dto)[key]) {
//             (<any>entity)[key] = (<any>dto)[key]
//         }
//     }

//     return entity
// }


// // test('textColumns', () => {

// //     console.log(textColumns(
// //         ['apt', 'dilate', 'minute', 'ointment', 'scant', 'some new word'],
// //         ['/w_11', '/w_12', '/w_11', '/w_11', '/w_13', '/w_15'],
// //     ));

// // })



// test('WordsList', () => {
//     const elements = Array.from(WordsList({
//         words: [
//             word({ id: 1, theword: 'word' })
//         ]
//     }))

//     console.log(elements);

// })

// type Tree = TreeElement[]
// type TreeComponent = SimpleElement[]
// type TreeElement = (SimpleElement | TreeComponent)

// type StatefulTreeComponent = (SimpleElement | StatefulTree)[]
// type StatefulTree = [any[], StatefulTreeComponent]

// function getInitialTree(comp: ComponentGenerator): StatefulTree {
//     const tree: TreeElement[] = []
//     const old = currentComponent.current

//     const state: any[] = []
//     currentComponent.current = { state, index: 0 }

//     for (const el of comp) {
//         if (isGenerator(el)) {
//             tree.push(
//                 getInitialTree(el)
//             )
//         } else {
//             tree.push(el)
//         }
//     }

//     currentComponent.current = old

//     return [state, tree]
// }

// function getTree(comp: ComponentGenerator, tree: StatefulTree): StatefulTree {
//     const [state, _] = tree
//     const old = currentComponent.current
//     currentComponent.current = { state, index: 0 }

//     const newTree: TreeElement[] = []

//     for (const el of comp) {
//         if (isGenerator(el)) {
//             newTree.push(
//                 // getTree(el)
//             )
//         } else {
//             newTree.push(el)
//         }
//     }
//     const newState = currentComponent.current.state
//     currentComponent.current = old
//     return [newState, tree]

// }


// const createWordEntity = (id: number, theword: string) => {
//     const word = new WordEntity()
//     word.id = id
//     word.theword = theword
//     return word
// }

// class RenderTreeComponentItem {
//     constructor(public element: SimpleElement) { }
// }

// class RenderTreeComponent {
//     constructor(public items: RenderTreeItem[]) { }
// }

// type RenderTreeItem = RenderTreeComponent | RenderTreeComponentItem

// type ComponentFunction<P> = (props: P) => ComponentGenerator


// function componentToRenderTree(component: ComponentGenerator) {

//     const tree: RenderTreeItem[] = []

//     for (const el of component) {
//         if (isGenerator(el)) {
//             tree.push(
//                 componentToRenderTree(el)
//             )
//         }
//         else {
//             tree.push(
//                 new RenderTreeComponentItem(el)
//             )
//         }
//     }

//     return new RenderTreeComponentItem(tree)
// }

// function* Comp1({ a }: { a: number }) {
//     yield a
//     yield new Comp(Comp3, { a })
// }

// function* Comp2({ b }: { b: string }) {
//     yield "aaa"
//     yield new Comp(Comp1, { a: Number.parseInt(b) })
//     yield 3
// }

// function* Comp3({ a }: { a: number }) {
//     yield a
// }

// class Comp<P> {
//     constructor(
//         public readonly func: (props: P) => ComponentGenerator,
//         public readonly props: P
//     ) { }

//     public instantiate = () => this.func(this.props)
// }

// function* App2() {
//     yield new Comp(Comp1, { a: 1 })
//     yield new Comp(Comp2, { b: "b" })
// }

// for (const comp of App2()) {
//     for(const el of comp.instantiate()) {
//         if(el instanceof Comp) {
//             for(const subel of el.instantiate()) {

//             }
//         } 
//         else {
//             el
//         }
//     }
// }

// test('App', () => {
//     const user = new UserEntity()

//     user.id = '1'
//     user.renderedMessagesIds = []
//     user.words = [
//         createWordEntity(1, 'aaa'),
//         createWordEntity(2, 'bbb'),
//     ]

//     console.log(App.name);

//     const generator = () => App({
//         user: user,
//         path: "words",
//         trainer: {
//             cards: []
//         },
//         settings: {
//             columns: 1
//         },
//         onCard: async () => { },
//         onAddExample: async () => { },
//         onDeleteWord: async () => { },
//         onRedirect: async () => { },
//         onReplaceWord: async () => { },
//         onUpdateSettings: async () => { },
//         onUpdateWord: async () => { },
//         onUpdatedTrainer: async () => { },
//     })

//     console.log('generator made');

//     const tree = getInitialTree(generator())

//     console.log(JSON.stringify(tree, null, 2));

//     (tree as any[])[1][2][0] = [true, 0]

//     console.log(JSON.stringify(tree, null, 2))

//     console.log(JSON.stringify(getTree(generator(), tree), null, 2))

// })