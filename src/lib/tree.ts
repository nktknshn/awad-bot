import { last } from "fp-ts/lib/Array"
import { cons } from "fp-ts/lib/ReadonlyArray"
import { ComponentConstructor, ComponentGenerator, isComponentElement, SimpleElement } from "./types"
import { range } from "./util"
import { equal, ObjectHelper } from "./util3dparty"

// export type Tree = [
//     ComponentElement, unknown, State,
//     (Tree | SimpleElement)[],
// ]

type SimpleOrComponent<E = SimpleElement> = ComponentsTree<SimpleOrComponent<E>> | E

interface ComponentsTree<K> {
    componentElement: ComponentConstructor
    props: unknown
    state: State
    result: K[]
}

type Z = SimpleOrComponent extends ComponentsTree<SimpleOrComponent> ? true : false
type ZZ = ComponentsTree<SimpleOrComponent> extends SimpleOrComponent ? true : false

function isComponentTree<T extends ComponentsTree<U>, U, K>(item: T | K): item is T {
    return 'componentElement' in item
}

type State = {
    value: any
}

export interface StateTree {
    state: State,
    children: StateTree[]
}

function isTree() {

}

export interface PropsTree {
    props: any,
    children: PropsTree[]
}

export interface TreeWithNewState extends ComponentsTree<TreeWithNewState | SimpleElement> {
    newState: State
}


export function getRenderFromTree(tree: ComponentsTree<SimpleOrComponent>): SimpleElement[] {
    const { componentElement, props, state, result: children } = tree

    let elements: SimpleElement[] = []

    for (const element of children) {
        if (isComponentTree(element)) {
            element
            elements = [...elements, ...getRenderFromTree(element)]
        }
        else {
            elements.push(element)
        }
    }

    return elements
}

export function copyPropsTree(tree: Tree): PropsTree {
    const { props, result: children } = tree

    const subComponents = children.filter((v): v is Tree => isComponentTree(v))

    return {
        props,
        children: subComponents.map(copyPropsTree)
    }
}

export function copyStateTree(tree: ComponentsTree<SimpleOrComponent>): StateTree {
    const { state, result: children } = tree

    const childrenState: any[] = []

    for (const item of children) {
        if (isComponentTree(item)) {
            childrenState.push(copyStateTree(item))
        }
    }

    return {
        state: ObjectHelper.deepCopy(state),
        children: childrenState
    }
}

export function extractStateTree(tree: ComponentsTree<SimpleOrComponent>): StateTree {
    const { result: children, componentElement, props, state } = tree

    const childrenState: StateTree[] = []

    for (const item of children) {
        if (isComponentTree(item)) {
            childrenState.push(extractStateTree(item))
        }
    }

    return {
        state,
        children: childrenState
    }
}

const str = (value: any) => {
    const result = JSON.stringify(value)
    return result.length < 100 ? result : result.slice(0, 50)
}


export function unzipState(tree: TreeWithNewState): ComponentsTree<SimpleOrComponent> {
    const { newState, componentElement, props, state, result: children } = tree
    return {
        componentElement,
        props,
        state: ObjectHelper.deepCopy(state),
        result: children
            .filter((_): _ is TreeWithNewState => isComponentTree(_))
            .map(unzipState)
    }
}

export function unzipNewState(tree: TreeWithNewState): ComponentsTree<SimpleOrComponent> {
    const {
        newState,
        result: children,
        componentElement,
        props,
        state
    } = tree

    return {
        componentElement,
        props,
        state: ObjectHelper.deepCopy(newState),
        result: children
            .filter((_): _ is TreeWithNewState => isComponentTree(_))
            .map(unzipNewState)
    }
}

export function zipTreeWithStateTree(tree: ComponentsTree<SimpleOrComponent>, stateTree: StateTree): TreeWithNewState {
    const { componentElement, props, state, result: children } = tree
    const {
        state: compNewState, children: childrenState
    } = stateTree

    let zippedChildren: (TreeWithNewState | SimpleElement)[] = []
    let stateIndex = 0

    for (const item of children) {
        if (isComponentTree(item)) {
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

    return {
        newState: ObjectHelper.deepCopy(compNewState),
        componentElement,
        props,
        state: ObjectHelper.deepCopy(state),
        result: zippedChildren
    }
}

export function assignStateTree(tree: ComponentsTree<SimpleOrComponent>, stateTree: StateTree): ComponentsTree<SimpleOrComponent> {
    const {
        componentElement, props, state, result: children
    } = tree

    const {
        state: compNewState, children: childrenState
    } = stateTree

    let items: SimpleOrComponent[] = []
    let assignedChildren: ComponentsTree<SimpleOrComponent>[] = []

    for (const item of children) {
        if (isComponentTree(item)) {
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

    return {
        componentElement,
        props,
        state: ObjectHelper.deepCopy(compNewState),
        result: items
    }
}

function instantiate<RootState>(
    component: ComponentConstructor,
    stateTree?: StateTree,
    rootState?: RootState) {

}

export function componentToTree<RootState>(
    component: ComponentConstructor,
    stateTree?: StateTree,
    rootState?: RootState
): ComponentsTree<SimpleOrComponent> {

    const children: SimpleOrComponent[] = []

    let state: State;
    let childrenState: StateTree[];

    if (stateTree !== undefined) {
        const copy = ObjectHelper.deepCopy(stateTree)
        state = copy.state
        childrenState = copy.children
        // {state, childrenState} = ObjectHelper.deepCopy(stateTree)
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

            console.log(`${component.cons.name}.getState(${str(initial)})=${str(result)}`)

            return result
        },
        setState: async (updates: State['value']) => {
            console.log(`${component.cons.name}.setState(${str(updates)}). Current: ${str(state.value)}`)
            state.value = { ...state.value, ...updates }
        }
    }

    let elements: ComponentGenerator;
    let props;

    if (component.kind === 'component') {
        props = component.props
        elements = component.cons(props)
    }
    else if (component.kind === 'component-with-state-connected') {
        props = {
            ...component.props,
            ...component.mapper(rootState)
        }

        elements = component.cons(props, getset)
    }
    else {
        props = component.props
        elements = component.cons(props, getset)
    }

    for (const element of elements) {
        if (element.kind === 'component') {
            children.push(componentToTree(element, iter.next().value, rootState))
        }
        else if (element.kind === 'component-with-state') {
            children.push(componentToTree(element, iter.next().value, rootState))
        }
        else if (element.kind === 'component-with-state-connected') {
            children.push(componentToTree(element, iter.next().value, rootState))
        }
        else {
            children.push(element)
        }
    }

    return {
        componentElement: component,
        props,
        result: children,
        state
    }
    // return [
    // component, component.props, state, items
    // ]
}
export type Tree = ComponentsTree<SimpleOrComponent>

export function renderTree<RootState>(
    tree: TreeWithNewState,
    component: ComponentConstructor,
    rootState?: RootState
): ComponentsTree<SimpleOrComponent> {
    const { newState, componentElement, props, state, result: children } = tree

    let rerender = false
    console.log(`checking ${componentElement.cons.name}`);

    if (componentElement.cons.name !== componentElement.cons.name) {
        console.log(`${componentElement.cons.name} is to updated by new component`);
        rerender = true
    }

    if (component.kind === 'component-with-state-connected') {
        const newProps = {
            ...component.props,
            ...component.mapper(rootState)
        }
        if (!equal(newProps, props)) {
            rerender = true
            console.log(`${componentElement.cons.name} is to updated by props`);

            return componentToTree(component,  { state: newState, children: [] }, rootState)
        }
    }
    else if (!equal(component.props, props)) {
        console.log(`${componentElement.cons.name} is to updated by props`);

        console.log(component.props)
        console.log(props)

        rerender = true
        return componentToTree(component,  { state: newState, children: [] }, rootState)
    }

    if (!equal(newState, state)) {
        console.log(`${componentElement.cons.name} is to updated by state`);
        rerender = true
    }

    if (rerender == true) {
        console.log(`${componentElement.cons.name} is to rerender`);
        return componentToTree(component, { state: newState, children: [] }, rootState)
    }

    console.log(`${componentElement.cons.name} is same`);

    let kids: SimpleOrComponent[] = []
    for (const item of children) {
        if (isComponentTree(item)) {
            kids.push(
                renderTree(item, item.componentElement, rootState)
            )
        }
        else {
            kids.push(item)
        }
    }

    return componentToTree(component,
        copyStateTree({
            state: ObjectHelper.deepCopy(newState),
            result: kids,
            componentElement: component,
            props
        }), rootState)
    // return componentToTree(
    //     component,
    //     copyStateTree(unzipNewState(tree)),
    //     rootState
    // )
}

export function printStateTree(stateTree: StateTree, depth = 0) {
    const { state, children } = stateTree

    if (children.length) {
        console.log(`${nspaces(depth)}Comp(${str(state)}) {`);
        for (const kid of children) {
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
    const { componentElement, props, state, result: children } = tree

    console.log(`${nspaces(depth)}${componentElement.cons.name}(${str(props)}, ${str(state)})`);

    for (const item of children) {
        if (isComponentTree(item)) {
            printTree(item, depth + 1)
        }
        else {
            // console.log(,);
            console.log(
                `${nspaces(depth + 1)}${str(item)}`);
        }
    }
}

export function printZippedTree(tree: TreeWithNewState, depth = 0) {
    const { newState, componentElement, props, state, result: children } = tree

    console.log(`${nspaces(depth)}${componentElement.cons.name}(props=${str(props)}, state=${str(state)}) new state ${str(newState)}`)

    for (const item of children) {
        if (isComponentTree(item)) {
            printZippedTree(item, depth + 1)
        }
        else {
            // console.log(,);
            console.log(
                `${nspaces(depth + 1)}${str(item)}`);
        }
    }
}