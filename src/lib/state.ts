import deepmerge from 'deepmerge'

export interface State<S> {
    getState(): S
    updateState(updates: Partial<S>): Promise<void>
    onUpdated?: (self: State<S>) => Promise<unknown>
}

export class State<S> {
    private state: S
    onUpdated?: (state: State<S>) => Promise<unknown>

    constructor(initialState: S) {
        this.state = initialState
    }
    getState() {
        return this.state
    }
    updateState = async (updates: Partial<S>) =>  {
        this.state = deepmerge(this.state, updates, {
            arrayMerge: (destinationArray, sourceArray, options) => sourceArray
        })

        if(this.onUpdated)
            await this.onUpdated(this)
    }
}

export const createState = <S>(initialState: S): State<S> =>
    new State(initialState)


export function combineSelectors<S1, S2, R1, R2>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
): Selector<S1 & S2, R1 & R2> {
    return function (state) {
        return { ...sel1(state), ...sel2(state) }
    }
}
export type Selector<S, R> = (state: S) => R


export function select<S1 = {}>(): Selector<S1, S1>
export function select<S1 = never, R1 = S1>(sel1: Selector<S1, R1>): Selector<S1, R1>
export function select<S1, S2, R1, R2>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
): Selector<S1 & S2, R1 & R2>
export function select<S1, S2, S3, R1, R2, R3>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
    sel3: Selector<S3, R3>,
): Selector<S1 & S2 & S3, R1 & R2 & R3>
export function select<S1, S2, S3, S4, R1, R2, R3, R4>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
    sel3: Selector<S3, R3>,
    sel4: Selector<S4, R4>,
): Selector<S1 & S2 & S3 & S4, R1 & R2 & R3 & R4>
export function select<S1, S2, S3, S4, S5, R1, R2, R3, R4, R5>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
    sel3: Selector<S3, R3>,
    sel4: Selector<S4, R4>,
    sel5: Selector<S5, R5>,
): Selector<S1 & S2 & S3 & S4 & S5, R1 & R2 & R3 & R4 & R5>
export function select<S1, S2, S3, S4, S5, S6, R1, R2, R3, R4, R5, R6>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
    sel3: Selector<S3, R3>,
    sel4: Selector<S4, R4>,
    sel5: Selector<S5, R5>,
    sel6: Selector<S6, R6>,
): Selector<S1 & S2 & S3 & S4 & S5 & S6, R1 & R2 & R3 & R4 & R5 & R6>
export function select<S1, S2, S3, S4, S5, S6, S7, R1, R2, R3, R4, R5, R6, R7>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
    sel3: Selector<S3, R3>,
    sel4: Selector<S4, R4>,
    sel5: Selector<S5, R5>,
    sel6: Selector<S6, R6>,
    sel7: Selector<S7, R7>,
): Selector<S1 & S2 & S3 & S4 & S5 & S6 & S7, R1 & R2 & R3 & R4 & R5 & R6 & R7>
export function select(...args: any[]): any {
    return function (s: any) {
        let res = {}
        for (const sel of args) {
            res = { ...res, ...sel(s) }
        }
        return res
    }
}