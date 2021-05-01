
export const setDoFlush = (doFlush: boolean) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { doFlush: boolean; }>(s: R) => ({ ...s, doFlush })
});

export const setBufferedInputEnabled = (bufferedInputEnabled: boolean) => ({
    kind: 'chatstate-action' as 'chatstate-action',
    f: <R extends { bufferedInputEnabled: boolean; }>(s: R) => ({ ...s, bufferedInputEnabled })
});
