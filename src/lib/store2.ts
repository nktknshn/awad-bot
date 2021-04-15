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
