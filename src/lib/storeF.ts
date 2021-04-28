import { Lens } from "monocle-ts";
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

type LensObject<S> = {
    [k in keyof S]-?: Lens<S, S[k]>
}

export function storef<S extends {}>(initial: S): StoreF<S> {
    return new StoreF<S>(initial)
}

export class StoreF<S extends {}> {
    state: S
    constructor(initial: S) {
        this.state = { ...initial }
    }

    public notify = (a: StoreAction<S>) => { mylog("set notify function"); }

    map(f: (u: S) => S): StoreF<S> {
        const n = new StoreF(f(this.state))
        return n
    }

    lens(): LensObject<S> {
        return Object.keys(this.state)
            .map(k => [k, Lens.fromProp<any>()(k)] as const)
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}) as any
    }
}

export function createStoreF<S>(initial: S) {
    return {
        store: new StoreF(initial)
    }
}


// export interface StoreAction<S> {
//     kind: 'store-action',
//     f: (s: S) => S
// }

export interface StoreAction<S> {
    kind: 'store-action',
    f: (s: S) => S
}

export const storeAction = <T extends any[], S>(
    f: (...args: T) => (s: S) => S): (...args: T) => StoreAction<S> => (...args) =>
    ({
        kind: 'store-action' as 'store-action',
        f: f(...args)
    })

export const wrapO = () => {

}