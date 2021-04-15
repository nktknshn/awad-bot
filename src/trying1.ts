import { range } from "./lib/util"

interface Element1 {
    kind: 'Element1'
    id: string
}

interface Element2 {
    kind: 'Element2'
    id: string
}

interface Element3 {
    kind: 'Element3'
    id: string
}

interface Element4 {
    kind: 'Element4'
    id: string
    callback: () => void
}

const element1 = (id: string): Element1 => ({ kind: 'Element1', id })
const element2 = (id: string): Element2 => ({ kind: 'Element2', id })
const element3 = (id: string): Element3 => ({ kind: 'Element3', id })
const element4 = (id: string, callback: () => void): Element4 => ({ kind: 'Element4', id, callback })

type ComponentGenerator<R = Elements> = Generator<R, unknown, unknown>

type CompConstructor<P, R> = ((props: P) => ComponentGenerator<R>)

type CompConstructorWithState<P, R, S = never> = (props: P, getset: GetSetState<S>) => ComponentGenerator<R>

interface ComponentStateless<P, R = Elements> {
    comp: CompConstructor<P, R>
    props: P,
    // state?: S,
    // instance: () => ComponentGenerator
    kind: 'component'
}

interface ComponentWithState<P, R = Elements, S = never> {
    comp: CompConstructorWithState<P, R, S>
    props: P,
    // state?: S,
    // instance: () => ComponentGenerator
    kind: 'component-with-state'
}


// interface Component<P> {
//     comp: (props: P) => ComponentGenerator
// }

// function Comp<P, R>(
//     comp: CompConstructor<P, R>,
//     props: P,
//     // state?: S
// ): ComponentStateless<P, R> {
//     return {
//         comp,
//         props,
//         kind: 'component'
//         // state,
//         // instance: () => comp(props, state)
//     }
// }

function CompWithState<P, R, S>(
    comp: CompConstructorWithState<P, R, S>,
    props: P
): ComponentWithState<P, R, S> {
    return {
        comp,
        props,
        kind: 'component-with-state'
    }
}

type SimpleElement = Element1 | Element2 | Element3 | Element4

type ComponentElement =
    | ComponentStateless<any, Elements>
    | ComponentWithState<any, Elements, any>

type Elements =
    | SimpleElement
    | ComponentElement

function isComponent<P>(element: Elements): element is ComponentStateless<unknown, Elements> {
    // return Symbol.iterator in Object(element)
    return 'comp' in element
}

type AppProps = { n: number }

type GetSetState<S> = {
    getState: (initialState?: S) => S
    setState: (state: Partial<S>) => Promise<void>
}

// function toString(el: SimpleElement): String 
function toString(el: SimpleElement) {
    return `${el.kind} (${el.id})`
}

const str = JSON.stringify

const nspaces = (n: number) => [...range(0, n)].map(_ => "  ").join('')


type Tree = [
    ComponentElement, unknown, State,
    (Tree | SimpleElement)[],
]

const isTree = (_: Tree | SimpleElement): _ is Tree => Array.isArray(_)

// function componentToTree<P>({ comp, props }: ComponentStateless<P>): Tree 

import equal from 'fast-deep-equal'
import { ObjectHelper } from "./lib/util3dparty"

function renderTree(tree: ZippedTree, component: ComponentElement): Tree {
    const [newState, comp, props, state, children] = tree

    let rerender = false

    if (component.comp.name !== comp.comp.name) {
        mylog(`${comp.comp.name} is to updated by new component`);
        rerender = true
    }

    if (!equal(component.props, props)) {
        mylog(`${comp.comp.name} is to updated by props`);
        rerender = true
    }

    if (!equal(newState, state)) {
        mylog(`${comp.comp.name} is to updated by state`);
        rerender = true
    }

    if (rerender == true) {
        return componentToTree(component, [newState, []])
    }

    return [
        comp,
        props,
        state,
        children.map(v => renderTree(v, v[1]))
    ]
}

type State = {
    value: any
}

type StateTree = [State, StateTree[]]

function copyStateTree(tree: Tree): StateTree {
    const [comp, props, state, children] = tree

    const childrenState: any[] = []

    for (const item of children) {
        if (isTree(item)) {
            childrenState.push(copyStateTree(item))
        }
    }

    return [ObjectHelper.deepCopy(state), childrenState]
}


function printStateTree(stateTree: StateTree, depth = 0) {
    const [state, states] = stateTree

    if (states.length) {
        mylog(`${nspaces(depth)}Comp(${str(state)}) {`);
        for (const kid of states) {
            printStateTree(kid, depth + 1)
        }
        mylog(`${nspaces(depth)}}`);
    }
    else {
        mylog(`${nspaces(depth)}Comp(${str(state)}) { }`);
    }
}

function componentToTree(component: ComponentElement, stateTree?: StateTree): Tree {

    const items: (Tree | SimpleElement)[] = []

    let state: State;
    let childrenState: StateTree[];

    if (stateTree !== undefined) {
        [state, childrenState] = ObjectHelper.deepCopy(stateTree)
        // state = stateValue
    }
    else {
        state = {
            value: undefined
        }
        childrenState = []
    }

    let iter = childrenState[Symbol.iterator]();

    const getset = {
        getState: (initial: State['value']) => {
            if (state.value === undefined)
                return state.value = initial

            return state.value
        },
        setState: async (updates: State['value']) => {
            state.value = updates
        }
    }

    let elements: ComponentGenerator<Elements>;

    if (component.kind === 'component') {
        elements = component.comp(component.props)
    }
    else {
        elements = component.comp(component.props, getset)
    }

    for (const element of elements) {
        if (element.kind === 'component') {
            items.push(componentToTree(element, iter.next().value))
        }
        else if (element.kind === 'component-with-state') {
            items.push(componentToTree(element, iter.next().value))
        }
        else {
            items.push(element)
        }
    }

    return [
        component, component.props, state, items
    ]
}

type ZippedTree = [
    State,
    ComponentElement,
    unknown,
    State,
    ZippedTree[]
]

function unzipState(tree: ZippedTree): Tree {
    const [newState, comp, props, state, children] = tree

    const kidsTree = []

    for (const item of children) {
        if (Array.isArray(item)) {
            kidsTree.push(unzipState(item))
        }
    }

    return [comp, props, ObjectHelper.deepCopy(state), kidsTree]
}



function zipTreeWithStateTree(tree: Tree, stateTree: StateTree): ZippedTree {
    const [comp, props, state, children] = tree
    const [compNewState, childrenState] = stateTree

    let zippedChildren: ZippedTree[] = []

    for (const item of children) {
        if (isTree(item)) {
            zippedChildren.push(
                zipTreeWithStateTree(
                    item,
                    childrenState[zippedChildren.length]
                ))
        }
    }

    return [
        ObjectHelper.deepCopy(compNewState),
        comp,
        props,
        ObjectHelper.deepCopy(state),
        zippedChildren
    ]
}


function printZippedTree(tree: ZippedTree, depth = 0) {
    const [compNewState, comp, props, state, children] = tree

    mylog(`${nspaces(depth)}${comp.comp.name}(props=${str(props)}, state=${str(state)}) new state ${str(compNewState)}`)

    for (const item of children) {
        if (Array.isArray(item)) {
            printZippedTree(item, depth + 1)
        }
        else {
            // mylog(,);
            mylog(
                `${nspaces(depth + 1)}${toString(item)}`);
        }
    }
}


function printTree(tree: Tree, depth = 0) {
    const [comp, props, state, children] = tree

    mylog(`${nspaces(depth)}${comp.comp.name}(${str(props)}, ${str(state)})`);

    for (const item of children) {
        if (isTree(item)) {
            printTree(item, depth + 1)
        }
        else {
            // mylog(,);
            mylog(
                `${nspaces(depth + 1)}${toString(item)}`);
        }
    }
}

function getRenderFromTree(tree: Tree): SimpleElement[] {
    const [comp, props, state, children] = tree

    let elements: SimpleElement[] = []

    for (const element of children) {
        if (isTree(element)) {
            elements = [...elements, ...getRenderFromTree(element)]
        }
        else {
            elements.push(element)
        }
    }

    return elements
}


type Comp1Props = { n: number }
type Comp2Props = { s: string }
type Comp3Props = { b: string[] }

type Comp4Props = { values: string[] }
type Comp4State = { page: number }

const Comp1 = Component(_Comp1)
const Comp2 = Component(_Comp2)
const Comp3 = Component(_Comp3)
const Comp4 = ComponentWithState(_Comp4)

function* _App({ n }: AppProps): Generator<Elements, void, unknown> {
    yield element1('element1 from App')

    yield Comp1({ n })
    yield Comp2({ s: 'aa' })
    yield Comp3({ b: [] })
    yield Comp4({ values: [] })
}

function* _Comp1({ n }: Comp1Props) {
    for (const _ of range(0, n))
        yield element2(`element2 from Comp1, n ${_}`)
}


function* _Comp2({ s }: Comp2Props) {
    yield element1('element1 from Comp2')
    yield Comp3({ b: [] })
}

function* _Comp3({ b }: Comp3Props) {
    yield element1('element1 from Comp3')
    yield element3('element3 from Comp3')
}

function* _Comp4(
    { values }: Comp4Props,
    { getState, setState }: GetSetState<Comp4State>
) {
    const { page } = getState({ page: 4 })

    // setState({ page: 10 })

    const { page: newPage } = getState()
    // setState({page: 10})

    for (const p of range(0, page))
        yield element1(`page: ${page}`)

    yield element1(`newPage=${newPage}`)

    yield element4('element4 from Comp4', () => setState({ page: 8 }))
}

function Component<P>(comp: CompConstructor<P, Elements>) {
    return function (props: P): ComponentStateless<P, Elements> {
        return {
            comp,
            props,
            kind: 'component'
        }
    }
}


function ComponentWithState<P, S>(comp: CompConstructorWithState<P, Elements, S>) {
    return function (props: P): ComponentWithState<P, Elements, S> {
        return {
            comp,
            props,
            kind: 'component-with-state'
        }
    }
}

(function main() {

    const App = Component(_App)

    const root = App({ n: 4 })

    const tree = componentToTree(root)
    const stateTree = copyStateTree(tree)

    // const elements = getRenderFromTree(tree)
    mylog();

    printTree(tree);

    mylog();
    printStateTree(stateTree);

    stateTree[1][3][0].value = { page: 11 }

    mylog();
    printStateTree(stateTree);

    const zipped = zipTreeWithStateTree(tree, stateTree)

    printZippedTree(zipped);

    mylog();

    const newTree = renderTree(zipped, App({ n: 4 }))

    printTree(newTree);

    const elements = getRenderFromTree(newTree)

    mylog();

    mylog(elements);

})()

// App