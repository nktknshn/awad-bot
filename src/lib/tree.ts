import { Store } from "redux"
import { BasicElement, ComponentElement, ComponentGenerator, isComponentElement } from "./elements"
import { nspaces, range } from "./util"
import { equal, ObjectHelper } from "./util3dparty"

type State<T = any> = {
    value: T
}

type BasicOrComponent<E = BasicElement> = ComponentsTreeNode<BasicOrComponent<E>> | E

export type ComponentTree = ComponentsTreeNode<BasicOrComponent>

interface ComponentsTreeNode<K, P = unknown, S = State> {
    componentElement: ComponentElement
    props: P
    state: S
    result: K[]
}

export interface ComponentStateTree {
    state: State,
    children: ComponentStateTree[]
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

export function getElementsFromTree(tree: ComponentTree): BasicElement[] {
    const { result } = tree

    let elements: BasicElement[] = []

    for (const element of result) {
        if (isComponentTree(element)) {
            element
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

export function copyStateTree(tree: ComponentsTreeNode<BasicOrComponent>): ComponentStateTree {
    const { state, result: children } = tree

    const childrenState: ComponentStateTree[] = []

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

export function extractStateTree(tree: ComponentsTreeNode<BasicOrComponent>): ComponentStateTree {
    const { result: children, componentElement, props, state } = tree

    const childrenState: ComponentStateTree[] = []

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

const str = <V>(value: V) => {
    const result = JSON.stringify(value)
    return result.length < 100 ? result : result.slice(0, 50)
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

export function zipTreeWithStateTree(tree: ComponentsTreeNode<BasicOrComponent>, stateTree: ComponentStateTree): TreeWithNewState {
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

export function assignStateTree(tree: ComponentsTreeNode<BasicOrComponent>, stateTree: ComponentStateTree): ComponentsTreeNode<BasicOrComponent> {
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



export function componentToComponentTree<R>(
    componentElement: ComponentElement,
    stateTree?: ComponentStateTree,
    rootState?: R
): ComponentTree {

    console.log('componentToTree!');

    const children: BasicOrComponent[] = []

    let state: State;
    let childrenState: ComponentStateTree[];

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

            console.log(`${componentElement.cons.name}.getState(${str(initial)})=${str(result)}`)

            return result
        },
        setState: async (updates: State['value']) => {
            console.log(`${componentElement.cons.name}.setState(${str(updates)}). Current: ${str(state.value)}`)
            state.value = { ...state.value, ...updates }
        }
    }

    let elements: ComponentGenerator;
    let props;

    if (componentElement.kind === 'component') {
        props = componentElement.props
        elements = componentElement.cons(props)
    }
    else if (componentElement.kind === 'component-with-state-connected') {
        props = {
            ...componentElement.props,
            ...componentElement.mapper(rootState)
        }
        elements = componentElement.cons(props, getset)
    }
    else {
        props = componentElement.props
        elements = componentElement.cons(props, getset)
    }

    for (const element of elements) {
        if (isComponentElement(element)) {
            children.push(
                componentToComponentTree(element, iter.next().value, rootState)
            )
        }
        else {
            children.push(element)
        }
    }

    return {
        componentElement, props, state, result: children
    }
}


export function rerenderTree<RootState>(
    tree: TreeWithNewState,
    component: ComponentElement,
    rootState?: RootState
): ComponentsTreeNode<BasicOrComponent> {
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

            return componentToComponentTree(component, { state: newState, children: [] }, rootState)
        }
    }
    else if (!equal(component.props, props)) {
        console.log(`${componentElement.cons.name} is to updated by props`);

        console.log(component.props)
        console.log(props)

        rerender = true
        return componentToComponentTree(component, { state: newState, children: [] }, rootState)
    }

    if (!equal(newState, state)) {
        console.log(`${componentElement.cons.name} is to updated by state`);
        rerender = true
    }

    if (rerender == true) {
        console.log(`${componentElement.cons.name} is to rerender`);
        return componentToComponentTree(component, { state: newState, children: [] }, rootState)
    }

    console.log(`${componentElement.cons.name} is same`);

    let kids: BasicOrComponent[] = []
    for (const item of children) {
        if (isComponentTree(item)) {
            kids.push(
                rerenderTree(item, item.componentElement, rootState)
            )
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
                .map(item => rerenderTree(item, item.componentElement, rootState)),
        }), rootState)
}

export function printStateTree(stateTree: ComponentStateTree, depth = 0) {
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



export function printTree(tree: ComponentTree, depth = 0) {
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


export class ElementsTree {
    private tree?: ComponentTree
    private prevStateTree?: ComponentStateTree
    private nextStateTree?: ComponentStateTree
    private lastPropsTree?: PropsTree

    public createElements = <P, S>(
        store: Store<S>,
        props: P,
        rootComponent: (props: P) => ComponentElement
    ): BasicElement[] => {
        console.log(`renderFunc`)

        const stateTreeIsSame = this.tree
            && equal(this.prevStateTree, this.nextStateTree)

        const propsAreSame = this.tree
            && equal(
                copyPropsTree(
                    componentToComponentTree(
                        rootComponent(props),
                        this.nextStateTree,
                        store.getState()
                    )
                ),
                this.lastPropsTree
            )

        if (stateTreeIsSame && propsAreSame) {
            console.log(`Props and state are same`);
            // await ui.renderGenerator()
            return getElementsFromTree(this.tree!)
        }

        if (this.prevStateTree && this.nextStateTree && this.tree) {

            const prevTree = assignStateTree(this.tree, this.prevStateTree)
            const zippedWithNewState = zipTreeWithStateTree(prevTree, this.nextStateTree)
            this.tree = rerenderTree(
                zippedWithNewState,
                rootComponent(props),
                store.getState()
            )
        }
        else {
            console.log('First draw!')
            this.tree = componentToComponentTree(
                rootComponent(props),
                undefined,
                store.getState()
            )
        }

        this.lastPropsTree = copyPropsTree(this.tree)
        this.prevStateTree = copyStateTree(this.tree)
        this.nextStateTree = extractStateTree(this.tree)

        return getElementsFromTree(this.tree)
    }
}
