import { chatstateAction } from "Lib/reducer";

export const setDoFlush =
    (doFlush: boolean) =>
        chatstateAction<{ doFlush: boolean; }>(
            s => ({ ...s, doFlush })
        )

export const setBufferedInputEnabled =
    (bufferedInputEnabled: boolean) =>
        chatstateAction<{ bufferedInputEnabled: boolean; }>(
            s => ({ ...s, bufferedInputEnabled })
        );
