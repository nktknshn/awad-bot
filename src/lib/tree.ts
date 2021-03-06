import { Store } from "redux"
import { Appliable, BasicElement, isComponentElement, LocalStateAction } from "./elements"
import { ComponentElement, ComponentGenerator } from "./component"
import { ComponentReqs, GetAllBasics } from "./types-util"
import { nspaces, range } from "./util"
import { equal, ObjectHelper } from "./util3dparty"
import { mylog } from "./logging"

type State<T extends {} = {}> = {
    value?: T
}

type BasicOrComponent<E = BasicElement> = ComponentsTreeNode<BasicOrComponent<E>> | E

export type ComponentTree = ComponentsTreeNode<BasicOrComponent>

interface ComponentsTreeNode<K, P = unknown, S = State> {
    componentElement: ComponentElement
    props: P
    state: S
    result: K[]
}

export interface ComponentLocalStateTree {
    state: State,
    children: ComponentLocalStateTree[]
}

export interface PropsTree<P = any> {
    props: P,
    children: PropsTree[]
}

export interface TreeWithNewState extends ComponentsTreeNode<TreeWithNewState | BasicElement> {
    newState: State
}

function isComponentTree<T extends ComponentsTreeNode<U>, U, K>(item: T | K): item is T {
    return 'componentElement' in item
}

export function getElementsFromTree<Els>(tree: ComponentTree): BasicElement[] {
    const { result } = tree

    let elements: BasicElement[] = []

    for (const element of result) {
        if (isComponentTree(element)) {
            elements = [...elements, ...getElementsFromTree(element)]
        }
        else {
            elements.push(element)
        }
    }

    return elements
}

export function copyPropsTree(tree: ComponentTree): PropsTree {
    const { props, result: children } = tree
    return {
        props,
        children: children
            .filter((v): v is ComponentTree => isComponentTree(v))
            .map(copyPropsTree)
    }
}

export function copyStateTree(tree: ComponentsTreeNode<BasicOrComponent>): ComponentLocalStateTree {
    const { state, result: children } = tree

    const childrenState: ComponentLocalStateTree[] = []

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

export function extractStateTree(tree: ComponentsTreeNode<BasicOrComponent>): ComponentLocalStateTree {
    const { result: children, componentElement, props, state } = tree

    const childrenState: ComponentLocalStateTree[] = []

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

export function unzipState(tree: TreeWithNewState): ComponentsTreeNode<BasicOrComponent> {
    const { componentElement, props, state, result } = tree
    return {
        componentElement,
        props,
        state: ObjectHelper.deepCopy(state),
        result: result
            .filter((_): _ is TreeWithNewState => isComponentTree(_))
            .map(unzipState)
    }
}

export function unzipNewState(tree: TreeWithNewState): ComponentsTreeNode<BasicOrComponent> {
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

export function zipTreeWithStateTree(tree: ComponentsTreeNode<BasicOrComponent>, stateTree: ComponentLocalStateTree): TreeWithNewState {
    const { componentElement, props, state, result: children } = tree
    const {
        state: compNewState, children: childrenState
    } = stateTree

    let zippedChildren: (TreeWithNewState | BasicElement)[] = []
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

export function assignStateTree(tree: ComponentsTreeNode<BasicOrComponent>, stateTree: ComponentLocalStateTree): ComponentsTreeNode<BasicOrComponent> {
    const {
        componentElement, props, state, result: children
    } = tree

    const {
        state: compNewState, children: childrenState
    } = stateTree

    let items: BasicOrComponent[] = []
    let assignedChildren: ComponentsTreeNode<BasicOrComponent>[] = []

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




export function printStateTree(stateTree: ComponentLocalStateTree, depth = 0, index: number[] = [0]) {
    const { state, children } = stateTree
    let counter = 0

    if (children.length) {
        console.log(`${index} ${nspaces(depth)}Comp(${str(state)}) {`);
        for (const kid of children) {
            printStateTree(kid, depth + 2, [...index, counter])
            counter += 1
        }
        console.log(`${nspaces(depth)}}`);
    }
    else {
        console.log(`${nspaces(depth)}Comp(${str(state)}) { }`);
    }
}



export function printTree(tree: ComponentTree, depth = 0, index: number[] = [0]) {
    const { componentElement, props, state, result: children } = tree

    console.log(`${index} ${nspaces(depth)}${componentElement.cons.name}(${str(props)}, ${str(state)})`);
    let counter = 0

    for (const item of children) {
        if (isComponentTree(item)) {
            printTree(item, depth + 2, [...index, counter])
        }
        else {
            // mylog(,);
            console.log(
                `${[...index, counter]} ${nspaces(depth + 2)}${str(item)}`);
        }
        counter += 1
    }
}

export function printZippedTree(tree: TreeWithNewState, depth = 0) {
    const { newState, componentElement, props, state, result: children } = tree

    mylog(`${nspaces(depth)}${componentElement.cons.name}(props=${str(props)}, state=${str(state)}) new state ${str(newState)}`)

    for (const item of children) {
        if (isComponentTree(item)) {
            printZippedTree(item, depth + 1)
        }
        else {
            // mylog(,);
            mylog(
                `${nspaces(depth + 1)}${str(item)}`);
        }
    }
}

import { Lens } from 'monocle-ts'
import { access } from "node:fs"


export function componentToComponentTree<R>(
    componentElement: ComponentElement,
    stateTree?: ComponentLocalStateTree,
    context?: R,
    index: number[] = []
): ComponentTree {

    mylog('componentToTree!');

    const children: BasicOrComponent[] = []

    let state: State;
    let childrenState: ComponentLocalStateTree[];

    if (stateTree !== undefined) {
        const copy = ObjectHelper.deepCopy(stateTree)
        state = copy.state
        childrenState = copy.children
    }
    else {
        state = {
            value: undefined
        }
        childrenState = []
    }

    let iter = childrenState[Symbol.iterator]();

    const setStateF = (ff: (s: State['value']) => State['value'])
        : LocalStateAction => {

        mylog(`${componentElement.cons.name}.setStateF(${ff}). 
            Current: ${str(state.value)}`)

        const f = (tree: TreeState) => {
            if (!tree.nextStateTree)
                return tree

            index = [...index]
            index.shift()

            if (index.length == 0) {
                mylog("tree.nextStateTree.state.value ",
                    tree.nextStateTree.state.value)

                const updated = ff(tree.nextStateTree.state.value!) ?? {}

                mylog("updated ", updated)

                for (const k of Object.keys(updated)) {
                    (tree.nextStateTree.state.value as any)[k] =
                        (updated as any)[k]
                }

                mylog("tree.nextStateTree.state.value ",
                    tree.nextStateTree.state.value)

                return tree
            }
            else {
                let s = tree.nextStateTree;
                for (const idx of index) {
                    s = s.children[idx]
                }
                const updated = ff(s.state.value!) ?? {}
                s.state.value = ({ ...s.state.value, ...updated })

                for (const k of Object.keys(updated)) {
                    (s.state.value as any)[k] = (updated as any)[k]
                }

                return tree
            }

        }

        return {
            index,
            kind: 'localstate-action' as 'localstate-action',
            f
        }
    }

    const getset = {
        getState: (initial: State['value']) => {
            let result = (() => {
                if (state.value === undefined)
                    state.value = ObjectHelper.deepCopy(initial)

                const cpy = ObjectHelper.deepCopy(state.value)
                return {
                    ...cpy,
                    lenses: Object.keys(cpy!)
                        .map(k => [k, Lens.fromProp<any>()(k)] as const)
                        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
                }
            })()

            mylog(`${componentElement.cons.name}.getState(${str(initial)})=${str(result)}`)

            return result
        },
        setState: async (updates: State['value']) => {
            mylog(`${componentElement.cons.name}.setState(${str(updates)}). Current: ${str(state.value)}`)
            state.value = { ...state.value, ...updates }
        },
        setStateFU: (updates: State['value']): LocalStateAction => {
            return {
                index,
                kind: 'localstate-action' as 'localstate-action',
                f: (tree) => tree
            }
        },
        setStateF
    }

    let elements: ComponentGenerator;
    let props;

    if (componentElement.kind === 'component') {
        props = componentElement.props
        elements = componentElement.cons(props)
    }
    else {
        props = {
            ...componentElement.props,
            ...componentElement.mapper(context)
        }
        elements = componentElement.cons(props, getset)
    }

    let idx = 0
    for (const element of elements) {
        if (isComponentElement(element)) {
            children.push(
                componentToComponentTree(
                    element, iter.next().value, context, [...index, idx])
            )
            idx += 1

        }
        else {
            children.push(element)
        }
    }

    return {
        componentElement, props, state, result: children
    }
}

interface RerenderResult {
    createdComponents: ComponentTree[],
    updatedComponents: ComponentTree[],
    removedComponents: ComponentTree[],
    tree: ComponentsTreeNode<BasicOrComponent>
}

export function rerenderTree<RootState>(
    tree: TreeWithNewState,
    component: ComponentElement,
    rootState?: RootState,
    index: number[] = []
): ComponentsTreeNode<BasicOrComponent> {
    const { newState,
        componentElement,
        props,
        state, result: children } = tree

    let rerender = false
    mylog(`checking ${componentElement.cons.toString()}`);

    if (componentElement.cons.toString() !== componentElement.cons.toString()) {
        mylog(`${componentElement.cons.name} is to updated by new component`);
        rerender = true
    }

    if (component.kind === 'component-with-state-connected') {
        mylog(`checking ${component.id}`);

        const newProps = {
            ...component.props,
            ...component.mapper(rootState)
        }

        if (!equal(newProps, props)) {
            rerender = true
            mylog(`${componentElement.cons.name} is to updated by props`);

            return componentToComponentTree(
                component,
                { state: newState, children: [] },
                rootState, index)
        }
    }
    else if (!equal(component.props, props)) {
        mylog(`${componentElement.cons.name} is to updated by props`);

        rerender = true
        return componentToComponentTree(component,
            { state: newState, children: [] }, rootState, index)
    }

    if (!equal(newState, state)) {
        mylog(`${componentElement.cons.name} is to updated by state`);
        rerender = true
    }

    if (rerender == true) {
        mylog(`${componentElement.cons.name} is to rerender`);
        return componentToComponentTree(component,
            { state: newState, children: [] }, rootState, index)
    }

    mylog(`${componentElement.cons.name} is same`);

    let kids: BasicOrComponent[] = []

    let idx = 0
    for (const item of children) {
        if (isComponentTree(item)) {
            kids.push(
                rerenderTree(item, item.componentElement,
                    rootState, [...index, idx])
            )
            idx += 1
        }
        else {
            kids.push(item)
        }
    }

    return componentToComponentTree(component,
        copyStateTree({
            componentElement: component,
            state,
            props,
            result: children
                .filter((_): _ is TreeWithNewState => isComponentTree(_))
                .map(item => rerenderTree(
                    item,
                    item.componentElement,
                    rootState)),
        }), rootState, index)
}


export interface TreeState {
    tree?: ComponentTree
    prevStateTree?: ComponentLocalStateTree
    nextStateTree?: ComponentLocalStateTree
    lastPropsTree?: PropsTree
}

export class ElementsTree {

    public static createElements<
        P,
        C extends ComponentElement,
        S extends ComponentReqs<C>,
        Els extends GetAllBasics<C>
    >(
        rootComponent: (props: P) => C,
        context: S,
        props: P,
        s: TreeState
    ): [Els[], TreeState] {

        mylog(`renderFunc`)

        s = { ...s }

        const stateTreeIsSame = s.tree
            && equal(s.prevStateTree, s.nextStateTree)

        const propsAreSame = s.tree
            && equal(
                copyPropsTree(
                    componentToComponentTree(
                        rootComponent(props),
                        s.nextStateTree,
                        context,
                        [0]
                    )
                ),
                s.lastPropsTree
            )

        if (stateTreeIsSame && propsAreSame) {
            mylog(`Props and state are same`);
            return [getElementsFromTree(s.tree!) as Els[], s]
        }

        if (s.prevStateTree && s.nextStateTree && s.tree) {

            const prevTree = assignStateTree(s.tree, s.prevStateTree)

            const zippedWithNewState = zipTreeWithStateTree(
                prevTree, s.nextStateTree)

            s.tree = rerenderTree(
                zippedWithNewState,
                rootComponent(props),
                context,
                [0]
            )
        }
        else {
            mylog('First draw!')
            s.tree = componentToComponentTree(
                rootComponent(props),
                undefined,
                context,
                [0]
            )
        }

        s.lastPropsTree = copyPropsTree(s.tree)
        s.prevStateTree = copyStateTree(s.tree)
        s.nextStateTree = extractStateTree(s.tree)

        return [getElementsFromTree(s.tree) as Els, s]
    }
    // }
}


const str = <V>(value: V) => {
    const result = JSON.stringify(value)
    return result
    // .length < 100 ? result : result.slice(0, 200)
}