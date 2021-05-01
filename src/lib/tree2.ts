import * as A from 'fp-ts/lib/Array';
import { pipe } from "fp-ts/lib/function";
import * as O from 'fp-ts/lib/Option';
import { AppReqs, GetAllBasics } from 'Libtypes-util';
import { equal } from 'Libutil3dparty';
import { Lens } from 'monocle-ts';
import { ComponentElement, ComponentGenerator } from "./component";
import { BasicElement, isComponentElement } from "./elements";

export interface TreeState {
    runResult: RunResultComponent,
    localStateTree: LocalStateTree<any>
}

function tabbedLog(s: string, tabs: number) {
    console.log(`${" ".repeat(tabs)}${s}`)
}

function str(v: any) {
    return JSON.stringify(v)
}
function printRunResultComponent2(res: RunResultComponent, tabs: number = 0) {
    const {
        comp, kind, result
    } = res

    if (comp.kind === 'component-with-state-connected') {
        tabbedLog(`- Component(${comp.cons.name})`, tabs);
        tabbedLog(`cons props(${str(comp.props)})`, tabs + 4);
        tabbedLog(`input:`, tabs + 2);
        tabbedLog(`props: ${str(result.input.props)}`, tabs + 4);
        tabbedLog(`localState: ${str(result.input.localState)}`, tabs + 4);
        tabbedLog(`output:`, tabs + 2);
        for (const el of result.output) {
            if (el.kind === 'component') {
                printRunResultComponent2(el, tabs + 4)
            }
            else {
                tabbedLog(`- ${el.element.kind}`, tabs + 4)
            }
        }
    }
}
function printLocalStateTree(t: LocalStateTree, tabs: number = 0) {
    const { childrenState, localState } = t
    tabbedLog(`- ${str(localState)}`, tabs)
    for (const el of childrenState) {
        if (el === undefined) {
            tabbedLog(`- element`, tabs + 2)
        }
        else {
            printLocalStateTree(el, tabs + 2)
        }
    }
}

export interface CreateElementsResult<Els> {
    elements: Els[]
    newElements: Els[]
    removedElements: Els[]
    treeState: TreeState
}

export function createElements<
    Props,
    C extends ComponentElement,
    S extends AppReqs<C>,
    Els extends GetAllBasics<C>
>
    (
        rootComponent: (props: Props) => C,
        context: S,
        props: Props,
        treeState?: TreeState
    ): CreateElementsResult<Els> {
    if (!treeState) {
        const runResult = runComponentTree(
            rootComponent(props), context
        )
        // printRunResultComponent2(runResult)
        // printLocalStateTree(extractLocalStateTree(runResult))
        const elements = extractElementsFromOutput(runResult.result.output) as Els[]
        return {
            treeState: {
                runResult,
                localStateTree: extractLocalStateTree(runResult)
            },
            elements,
            newElements: elements,
            removedElements: []
        }
    }

    const runResult = rerunComponentTree(
        treeState.runResult,
        rootComponent(props),
        context,
        treeState.localStateTree
    )

    // printRunResultComponent2(runResult)
    // printLocalStateTree(extractLocalStateTree(runResult))

    const { elements, removedElements, newElements } = extractElementsFromRerun<Els>(runResult)

    return {
        treeState: {
            runResult,
            localStateTree: extractLocalStateTree(runResult)
        },
        elements, removedElements, newElements
    }
}

export interface LocalStateTree<S = any> {
    localState: LocalState<S>
    childrenState: (LocalStateTree<any> | undefined)[]
}

type RunResult = RunResultComponent<RunResult> | RunResultElement

export interface RunResultComponent<O extends RunResult = RunResult> {
    kind: 'component',
    comp: ComponentElement,
    result: {
        input: {
            props: unknown,
            localState: any
        },
        output: O[]
    }
}

export interface RunResultElement {
    kind: 'element',
    element: BasicElement
}

export function extractLocalStateTree(runResult: RunResultComponent<RunResult>): LocalStateTree {
    return {
        localState: runResult.result.input.localState,
        childrenState: runResult.result.output.map(el => {
            if (el.kind === 'component') {
                return extractLocalStateTree(el)
            }
            else {
                return undefined
            }
        })
    }
}

export interface PropsTree {
    props: any,
    childrenProps: (PropsTree | undefined)[]
}

export function extractPropsTree(runResult: RunResultComponent<RunResult>): PropsTree {
    return {
        props: runResult.result.input.props,
        childrenProps: runResult.result.output.map(el => {
            if (el.kind === 'component') {
                return extractPropsTree(el)
            }
            else {
                return undefined
            }
        })
    }
}

interface RerunElements<Els> {
    elements: Els[]
    newElements: Els[]
    removedElements: Els[]
}

export function extractRunResultFromRerun(res: RerunResultUpdated | RerunResultNotUpdated): RunResultComponent {
    return res
}

export function extractElementsFromRerun<Els extends BasicElement>(res: RerunResultUpdated | RerunResultNotUpdated): RerunElements<Els> {
    let newElements: Els[] = []
    let removedElements: Els[] = []

    if (res.rerunkind === 'updated') {
        removedElements = extractElementsFromOutput(res.oldChildren) as Els[]
        newElements = extractElementsFromOutput(res.result.output.filter(_ => _.kind === 'component')) as Els[]
    }

    return {
        elements: extractElementsFromOutput(res.result.output) as Els[]
        , newElements, removedElements
    }
}

export function extractElementsFromOutput(output: RunResult[]): BasicElement[] {
    return pipe(
        output,
        A.map(_ =>
            _.kind === 'component'
                ? extractElementsFromOutput(_.result.output)
                : [_.element]
        ),
        A.flatten
    )
}

export interface RerunResultUpdated extends RunResultComponent<RunResult> {
    rerunkind: 'updated'
    oldChildren: RunResult[]
}

export interface RerunResultNotUpdated extends RunResultComponent<RerunResult> {
    rerunkind: 'not-updated'
}

export type RerunResult = RerunResultUpdated | RerunResultNotUpdated | RunResultElement

/* 
if a component was updated then all his old children are removed
and all his new children are created
*/
export function rerunComponentTree<C, S>(
    previousRun: RunResultComponent<RunResult>,
    comp: ComponentElement,
    context: C,
    localStateTree: LocalStateTree<S>,
    index: number[] = [0]
): RerunResultUpdated | RerunResultNotUpdated {
    const {
        comp: prevComp,
        result
    } = previousRun

    const { localState, childrenState } = localStateTree
    const { closure, getset } = createLocalState(index, localState)

    let rerender = false;

    if (prevComp.id != comp.id) {
        rerender = true
    }

    const { generator, props } = runComponent(comp, context, getset)

    if (!equal(props, result.input.props)) {
        rerender = true
    }

    if (!equal(closure, result.input.localState)) {
        rerender = true
    }

    if (rerender) {
        return {
            rerunkind: 'updated',
            oldChildren: result.output,
            ...runComponentTree(
                comp, context,
                { localState: closure, childrenState: [] },
                index
            )
        }
    }

    const output = pipe(
        result.output,
        A.zip(childrenState.length == result.output.length
            ? childrenState
            : A.replicate(result.output.length, undefined)),
        A.mapWithIndex((idx, [_, s]) => _.kind === 'element'
            ? _
            : rerunComponentTree(_, _.comp, context, s!, [...index, idx]))
    )

    return {
        rerunkind: 'not-updated',
        comp, kind: 'component',
        result: {
            input: result.input,
            output
        }
    }

}

export function runComponentTree<C, S>(
    comp: ComponentElement,
    context: C,
    localStateTree?: LocalStateTree<S>,
    index: number[] = [0]
): RunResultComponent<RunResult> {

    const { localState, childrenState } = localStateTree ?? {
        localState: undefined,
        childrenState: undefined
    }


    const { closure, getset } = createLocalState(index, localState)
    const { generator, props } = runComponent(comp, context, getset)

    const elements = [...generator()]

    const z = pipe(elements,
        A.zip(childrenState && childrenState.length == elements.length ?
            childrenState
            : pipe(elements,
                A.map((_): (LocalStateTree<any> | undefined) => undefined))
        ))

    let output: RunResult[] = []
    let idx = 0

    for (const [element, state] of z) {
        if (isComponentElement(element)) {
            output.push(
                runComponentTree(element, context, state, [...index, idx])
            )
        }
        else {
            output.push({
                kind: 'element',
                element
            })
        }
        idx += 1
    }

    return {
        kind: 'component',
        comp,
        result: {
            input: { props, localState: closure, },
            output
        }
    }
}


function runComponent<C, S>(
    comp: ComponentElement,
    context: C,
    getset: GetSetState<S>
): {
    compId: string,
    props: any,
    generator: () => ComponentGenerator<BasicElement | ComponentElement>
} {
    const props = { ...comp.props, ...comp.mapper(context) }
    return {
        compId: comp.id ?? comp.cons.toString(),
        props,
        generator: () => comp.cons(props, getset as any)
    }
}

interface LocalState<S> {
    value?: S,
    updated: boolean
}

export interface LocalStateAction<S = any> {
    kind: 'localstate-action',
    index: number[],
    f: (s: S) => S
}


type LensObject<S> = {
    [k in keyof S]-?: Lens<S, S[k]>
}


export type GetSetState<S> = {
    getState: (initialState: S) => S 
    setState: (f: (s: S) => S) => LocalStateAction<S>
    lenses: <K extends keyof S>(k: K) => Lens<S, S[K]>
}

function createGetSet<S>(index: number[], localState: LocalState<S>): GetSetState<S> {
    return {
        getState: (initial: S) => {
            if (localState.value === undefined) {
                localState.value = initial
            }
            return {
                ...localState.value, 
            }
        },
        setState: (f: (s: S) => S) => ({
            index,
            kind: 'localstate-action',
            f
        }),
        lenses: (k) => Lens.fromProp<S>()(k)

    }
}

function createLocalState<S>(index: number[], localState?: LocalState<S>): {
    getset: GetSetState<S>,
    closure: LocalState<S>
} {
    let state: LocalState<S>;

    if (localState === undefined) {
        state = {
            value: undefined,
            updated: false
        }

        return {
            closure: state,
            getset: createGetSet(index, state)
        }
    }
    else {
        return {
            closure: localState,
            getset: createGetSet(index, localState)
        }
    }
}

export function applyLocalStateAction(
    tree: LocalStateTree,
    action: LocalStateAction<any>
): LocalStateTree {
    return applyFunctionAtIndex(
        tree,
        action,
        action.index.slice(
            1
        )
    )
    // console.log('applyLocalStateAction');
    // console.log(res);

    // return res
}

export function applyFunctionAtIndex(
    tree: LocalStateTree,
    action: LocalStateAction<any>,
    index: number[]
): LocalStateTree {

    if (index.length == 0) {
        return {
            localState: {
                value: action.f(tree.localState.value),
                updated: true
            },
            childrenState: tree.childrenState
        }
    } else {
        return {
            localState: tree.localState,
            childrenState: pipe(tree.childrenState,
                A.modifyAt(index[0], s => applyFunctionAtIndex(
                    s!,
                    action,
                    index.slice(1)
                )), O.fold(() => tree.childrenState, v => v))
        }
    }
}