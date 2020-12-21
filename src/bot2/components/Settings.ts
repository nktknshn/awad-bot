import { message, radioRow } from "../../lib/helpers";
import { Getter } from "../../lib/util";
import { AppProps } from "../app";


export function* Settings({
    settings, onUpdateSettings
}: Getter<AppProps, 'settings', 'onUpdateSettings'>) {
    yield message(`columns: ${settings.columns}`);
    yield radioRow(['1', '2'], (idx, data) => onUpdateSettings({ columns: (idx + 1) as (1 | 2) }),
        String(settings.columns));
}
