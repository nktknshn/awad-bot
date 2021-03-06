import { ConnectedComp } from "../../lib/component";
import { message, radioRow } from "../../lib/elements-constructors";
import { select } from "../../lib/state";
import { Getter } from "../../lib/util";
import { RootState } from "../store";
import { getDispatcher, getSettings } from "../store/selectors";
import { WithDispatcher } from "../storeToDispatch";

export default ConnectedComp(
    function* Settings({
        settings, dispatcher
    }: Getter<RootState, 'settings'> & WithDispatcher) {
        yield message(`columns: ${settings.columns}`);
        yield radioRow(['1', '2'], (idx, data) => dispatcher.onUpdateSettings({ columns: (idx + 1) as (1 | 2) }),
            String(settings.columns));
    }, 
select(getDispatcher, getSettings))