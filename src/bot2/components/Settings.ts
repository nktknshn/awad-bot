import { message, radioRow } from "../../lib/constructors";
import { Getter } from "../../lib/util";
import { AppProps } from "../app";
import { RootState } from "../store";


export function* Settings({
    settings, onUpdateSettings
}: Getter<AppProps & RootState, 'settings', 'onUpdateSettings'>) {
    yield message(`columns: ${settings.columns}`);
    yield radioRow(['1', '2'], (idx, data) => onUpdateSettings({ columns: (idx + 1) as (1 | 2) }),
        String(settings.columns));
}
