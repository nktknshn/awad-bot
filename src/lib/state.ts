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
