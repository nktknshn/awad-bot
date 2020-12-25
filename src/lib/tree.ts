import { last } from "fp-ts/lib/Array"
import { cons } from "fp-ts/lib/ReadonlyArray"
import { ComponentElement, ComponentGenerator, SimpleElement } from "./types"
import { range } from "./util"
import { equal, ObjectHelper } from "./util3dparty"

export type Tree = [
    ComponentElement, unknown, State,
    (Tree | SimpleElement)[],
]

type State = {
    value: any
}

export type StateTree = [State, StateTree[]]

export type ZippedTree = [
    State,
    ComponentElement,
    unknown,
    State,
    (ZippedTree | SimpleElement)[]
]



export function getRenderFromTree(tree: Tree): SimpleElement[] {
    const [comp, props, state, children] = tree

    let elements: SimpleElement[] = []

    for (const element of children) {
        if (Array.isArray(element)) {
            elements = [...elements, ...getRenderFromTree(element)]
        }
        else {
            elements.push(element)
        }
    }

    return elements
}

export function copyStateTree(tree: Tree): StateTree {
    const [comp, props, state, children] = tree

    const childrenState: any[] = []

    for (const item of children) {
        if (Array.isArray(item)) {
            childrenState.push(copyStateTree(item))
        }
    }

    return [ObjectHelper.deepCopy(state), childrenState]
}

export function extractStateTree(tree: Tree): StateTree {
    const [comp, props, state, children] = tree

    const childrenState: any[] = []

    for (const item of children) {
        if (Array.isArray(item)) {
            childrenState.push(extractStateTree(item))
        }
    }

    return [state, childrenState]
}

const str = (value: any) => JSON.stringify(value).slice(0, 50)


export function unzipState(tree: ZippedTree): Tree {
    const [newState, comp, props, state, children] = tree

    const kidsTree = []

    for (const item of children) {
        if (Array.isArray(item)) {
            kidsTree.push(unzipState(item))
        }
    }

    return [comp, props, ObjectHelper.deepCopy(state), kidsTree]
}

export function unzipNewState(tree: ZippedTree): Tree {
    const [newState, comp, props, state, children] = tree

    const kidsTree = []

    for (const item of children) {
        if (Array.isArray(item)) {
            kidsTree.push(unzipNewState(item))
        }
    }

    return [comp, props, ObjectHelper.deepCopy(newState), kidsTree]
}

export function zipTreeWithStateTree(tree: Tree, stateTree: StateTree): ZippedTree {
    const [comp, props, state, children] = tree
    const [compNewState, childrenState] = stateTree

    let zippedChildren: (ZippedTree | SimpleElement)[] = []
    let stateIndex = 0

    for (const item of children) {
        if (Array.isArray(item)) {
            zippedChildren.push(
                zipTreeWithStateTree(
                    item,
                    childrenState[stateIndex]
                ))

            stateIndex += 1
        }
        else {
            zippedChildren.push(item)
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

export function assignStateTree(tree: Tree, stateTree: StateTree): Tree {
    const [comp, props, state, children] = tree
    const [compNewState, childrenState] = stateTree

    let items: (Tree | SimpleElement)[] = []
    let assignedChildren: Tree[] = []

    for (const item of children) {
        if (Array.isArray(item)) {
            assignedChildren.push(
                assignStateTree(
                    item,
                    childrenState[assignedChildren.length]
                )
            )
            items.push(assignedChildren[assignedChildren.length - 1])
        }
        else {
            items.push(item)
        }
    }

    return [
        comp,
        props,
        ObjectHelper.deepCopy(compNewState),
        items
    ]
}

export function componentToTree(component: ComponentElement, stateTree?: StateTree): Tree {

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
            let result = (() => {
                if (state.value === undefined)
                    state.value = ObjectHelper.deepCopy(initial)

                return ObjectHelper.deepCopy(state.value)
            })()

            console.log(`${component.comp.name}.getState(${str(initial)})=${str(result)}`)

            return result
        },
        setState: async (updates: State['value']) => {
            console.log(`${component.comp.name}.setState(${str(updates)}). Current: ${str(state.value)}`)
            state.value = updates
        }
    }

    let elements: ComponentGenerator;

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

export function renderTree(tree: ZippedTree, component: ComponentElement): Tree {
    const [newState, comp, props, state, children] = tree

    let rerender = false

    if (component.comp.name !== comp.comp.name) {
        console.log(`${comp.comp.name} is to updated by new component`);
        rerender = true
    }

    if (!equal(component.props, props)) {
        console.log(`${comp.comp.name} is to updated by props`);

        console.log(component.props)
        console.log(props)

        rerender = true
    }

    if (!equal(newState, state)) {
        console.log(`${comp.comp.name} is to updated by state`);
        rerender = true
    }

    if (rerender == true) {
        return componentToTree(component, [newState, []])
    }

    return componentToTree(
        component,
        copyStateTree(unzipNewState(tree))
    )
    // return [
    //     comp,
    //     props,
    //     state,
    //     children.map(v => Array.isArray(v) ? renderTree(v, v[1]) : v)
    // ]
}

export function printStateTree(stateTree: StateTree, depth = 0) {
    const [state, states] = stateTree

    if (states.length) {
        console.log(`${nspaces(depth)}Comp(${str(state)}) {`);
        for (const kid of states) {
            printStateTree(kid, depth + 1)
        }
        console.log(`${nspaces(depth)}}`);
    }
    else {
        console.log(`${nspaces(depth)}Comp(${str(state)}) { }`);
    }
}

const nspaces = (n: number) => [...range(0, n)].map(_ => "  ").join('')

// function toString(el: SimpleElement) {
//     return `${el.kind} (${el.id})`
// }

export function printTree(tree: Tree, depth = 0) {
    const [comp, props, state, children] = tree

    console.log(`${nspaces(depth)}${comp.comp.name}(${str(props)}, ${str(state)})`);

    for (const item of children) {
        if (Array.isArray(item)) {
            printTree(item, depth + 1)
        }
        else {
            // console.log(,);
            console.log(
                `${nspaces(depth + 1)}${str(item)}`);
        }
    }
}

export function printZippedTree(tree: ZippedTree, depth = 0) {
    const [compNewState, comp, props, state, children] = tree

    console.log(`${nspaces(depth)}${comp.comp.name}(props=${str(props)}, state=${str(state)}) new state ${str(compNewState)}`)

    for (const item of children) {
        if (Array.isArray(item)) {
            printZippedTree(item, depth + 1)
        }
        else {
            // console.log(,);
            console.log(
                `${nspaces(depth + 1)}${str(item)}`);
        }
    }
}