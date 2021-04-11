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
        // console.log(`this.state={${JSON.stringify(updates)}}`)

        this.state = deepmerge(this.state, updates, {
            arrayMerge: (destinationArray, sourceArray, options) => sourceArray
        })

        // console.log(`this.state={${JSON.stringify(this.state)}}`)

        if(this.onUpdated)
            await this.onUpdated(this)
    }
}

export const createState = <S>(initialState: S): State<S> =>
    new State(initialState)


export function combine<S1, S2, R1, R2>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
): Selector<S1 & S2, R1 & R2> {
    return function (state) {
        return { ...sel1(state), ...sel2(state) }
    }
}
export type Selector<S, R> = (state: S) => R


export function req<S1, R1>(sel1: Selector<S1, R1>): Selector<S1, R1>
export function req<S1, S2, R1, R2>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
): Selector<S1 & S2, R1 & R2>
export function req<S1, S2, S3, R1, R2, R3>(
    sel1: Selector<S1, R1>,
    sel2: Selector<S2, R2>,
    sel3: Selector<S3, R3>,
): Selector<S1 & S2 & S3, R1 & R2 & R3>
export function req(...args: any[]): any {
    return function (s: any) {
        let res = {}
        for (const sel of args) {
            res = { ...res, ...sel(s) }
        }
        return res
    }
}
