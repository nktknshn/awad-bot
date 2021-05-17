import { pipe } from 'fp-ts/lib/pipeable';
import { connected } from 'Lib/component';
import { AP, CA, chatState, FL, DE, TR, createLevelTracker, BU } from 'Lib/lib';
import { select } from 'Lib/state';
import { GetState } from 'Lib/types-util';
import { token } from '../notion-token.json'
import { Client } from '@notionhq/client'

const notion = new Client({
    auth: token,
});

const App = connected(
    select(),
    function* () {

    }
)

const state = () => chatState([
    DE.defaultState(),
    TR.withTrackingRenderer(createLevelTracker('mydb_bot7')),
    async () => ({

    })
])

export const stateToContext = (cs: GetState<typeof state>) => ({

})

export const app = pipe(
    BU.startBuild(App, state)
    , AP.context(stateToContext)
)

notion.databases.list({

}).then(d => console.log(d))