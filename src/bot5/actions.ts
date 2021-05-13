import { chatStateAction } from "Lib/reducer";

export const setDoFlush =
    (doFlush: boolean) =>
        chatStateAction<{ doFlush: boolean; }>(
            s => ({ ...s, doFlush })
        )

export const setBufferedInputEnabled =
    (bufferedInputEnabled: boolean) =>
        chatStateAction<{ bufferedInputEnabled: boolean; }>(
            s => ({ ...s, bufferedInputEnabled })
        );
