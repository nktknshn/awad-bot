import { message, radioRow } from "../../lib/elements-constructors";
import { Getter } from "../../lib/util";
import { AppDispatch, WithDispatcher } from "../app";
import { RootState } from "../store";

export function* Settings({
    settings, dispatcher
}: Getter<AppDispatch & RootState, 'settings'> & WithDispatcher) {
    yield message(`columns: ${settings.columns}`);
    yield radioRow(['1', '2'], (idx, data) => dispatcher.onUpdateSettings({ columns: (idx + 1) as (1 | 2) }),
        String(settings.columns));
}
