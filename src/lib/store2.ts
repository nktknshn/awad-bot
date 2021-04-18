import { mylog } from "./logging";

type Store<S> = {
    state: S;
    notify: () => Promise<void>;
    subscribe: (f: () => Promise<void>) => void;
};


export function createStore<S>(state: S) {
    const store: Store<S> = {
        state,
        notify: async () => { mylog("set notify function"); },
        subscribe: (notify: () => Promise<void>) => {
            store.notify = notify
        }
    };
    const notify = () => store.notify();
    const getState = () => store.state;
    const update = (f: (s: S) => S) => {
        store.state = f(store.state)
    };

    const updateNotify = async (f: (s: S) => S) => {
        update(f)
        await notify()
    };

    const updateC = (u: Partial<S>) => update(s => ({ ...s, ...u }));

    return {
        store, notify, getState, update, updateC, updateNotify
    };
}


export class StoreF<S> {
    state: S
    constructor(initial: S) {
        this.state = { ...initial }
    }

    public notify = (a: StoreAction<S, S>) => { mylog("set notify function"); }

    apply(f: (u: S) => S) {
        const n = new StoreF(f(this.state))
        return n
    }
}

export function createStoreF<S>(initial: S) {
    return {
        store: new StoreF(initial)
    }
}


export interface StoreAction<S, R> {
    kind: 'store-action',
    f: (s: S) => R
}

export const wrap = <T extends any[], R, S>(f: (...args: T) => (s: S) => R):
(...args: T) => StoreAction<S, R> => (...args) => ({
    kind: 'store-action' as 'store-action',
    f: f(...args)
})

export const wrapO = () => {
    
}