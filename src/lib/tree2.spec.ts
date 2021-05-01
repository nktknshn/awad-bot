import { connected } from "./component"
import { applyLocalStateAction, extractLocalStateTree, extractPropsTree, GetSetState, LocalStateTree, PropsTree, rerunComponentTree, RerunResult, RerunResultNotUpdated, RerunResultUpdated, runComponentTree, RunResultComponent } from "./tree2"
import { message } from './elements-constructors'

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

function printReRunResultComponent2(res: RerunResultUpdated | RerunResultNotUpdated, tabs: number = 0) {
    const {
        comp, kind, result, rerunkind
    } = res

    if (comp.kind === 'component-with-state-connected') {

        tabbedLog(`- ${rerunkind} Component(${comp.cons.name})`, tabs);
        tabbedLog(`cons props(${str(comp.props)})`, tabs + 4);
        tabbedLog(`input:`, tabs + 2);
        tabbedLog(`props: ${str(result.input.props)}`, tabs + 4);
        tabbedLog(`localState: ${str(result.input.localState)}`, tabs + 4);
        tabbedLog(`output:`, tabs + 2);

        if (res.rerunkind === 'not-updated') {
            for (const el of res.result.output) {
                if (el.kind === 'component') {
                    printReRunResultComponent2(el, tabs + 4)
                }
                else {
                    tabbedLog(`- ${el.element.kind}`, tabs + 4)
                }
            }
        }
        else {
            for (const el of res.result.output) {
                if (el.kind === 'component') {
                    printRunResultComponent2(el, tabs + 4)
                }
                else {
                    tabbedLog(`- ${el.element.kind}`, tabs + 4)
                }
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

function printPropsTree(t: PropsTree, tabs: number = 0) {
    const { childrenProps, props } = t
    tabbedLog(`- ${str(props)}`, tabs)
    for (const el of childrenProps) {
        if (el === undefined) {
            tabbedLog(`- element`, tabs + 2)
        }
        else {
            printPropsTree(el, tabs + 2)
        }
    }
}

const comp3 = connected(
    () => ({}),
    function* (ctx, { name }: { name: string }, { getState, setState }: GetSetState<{
        compName: string
    }>) {
        const { compName } = getState({ compName: name })

        yield message("Third comp" + compName)
    }
)

const comp2 = connected(
    () => ({}),
    function* (ctx, props, { getState, setState }: GetSetState<{
        name: string
    }>) {
        const { name } = getState({ name: "aaaa" })

        yield message("Second comp")
        yield comp3({ name })
    }
)

const comp1 = connected(
    (n: { name: string }) => ({ name: n.name }),
    function* (
        ctx,
        { abc }: { abc: number },
        { getState, setState }: GetSetState<{
            counter: number
        }>
    ) {
        const { counter } = getState({ counter: 100 })

        yield message(abc.toString())

        yield comp2({})
    }
)

const res = runComponentTree(
    comp1({ abc: 1 }),
    { name: "lol" }
)

printRunResultComponent2(res)
console.log();

printLocalStateTree(extractLocalStateTree(res))
// printPropsTree(extractPropsTree(res))
const t1 = extractLocalStateTree(res)

const t2 = applyLocalStateAction(
    t1,
    {
        kind: 'localstate-action',
        index: [0, 1],
        f: ({ name }) => ({ name: `${name} dsdsd` })
    }
)

console.log();
printLocalStateTree(t1)
console.log();

printLocalStateTree(t2)

const res2 = rerunComponentTree(
    res,
    comp1({ abc: 1 }),
    { name: "lol" },
    t2
)

printReRunResultComponent2(res2);
