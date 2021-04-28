
export type Flush = { kind: 'flush' } 

export const flush = (): Flush => ({
    kind: 'flush'
})

export interface RenderEvent<AppAction> {
    kind: 'RenderEvent'
    actions?: AppAction[]
}

export interface StateActionEvent<AppAction> {
    kind: 'StateActionEvent',
    actions: AppAction[]
}


export const deferRender = (n: number) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { deferRender: number }>(s: R) =>
        ({ ...s, deferRender: n })
})