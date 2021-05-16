import { setDoFlush } from "bot5/actions";
import { connected } from "Lib/component";
import * as FL from "Lib/components/actions/flush";
import { contextSelector } from "Lib/context";
import * as DE from "Lib/defaults";
import { button, buttonsRow, messagePart, nextMessage } from "Lib/elements-constructors";
import { ChatState } from "./index7";
import { refresh, clear, toggleInfo, asn, apps, setActiveApp, ActiveApp } from "./asn";

export const infoContext = contextSelector<ChatState>()(
    'activeApp', 'error', 'reloadOnStart', 'bufferedInputEnabled',
    'timerStarted', 'timerFinished', 'bufferActions', 'deferRender', 'doFlush',
    'timerDuration'
);
export const Info = connected(
    infoContext.fromContext,
    function* (c) {
        yield messagePart(`hi ${c.activeApp} reloadOnStart=${c.reloadOnStart}`);
        yield messagePart(`error=${c.error}`);
        yield messagePart(`bufferedInputEnabled=${c.bufferedInputEnabled}`);
        yield messagePart(`deferRender=${c.deferRender}`);
        yield messagePart(`bufferActions=${c.bufferActions}`);
        yield messagePart(`doFlush=${c.doFlush}`);

        yield messagePart(`render duration=${c.timerDuration}`);

        yield nextMessage();
        yield button('refresh', refresh);
        yield button('clear', clear);
        yield button('hide', toggleInfo);

        yield button(`doFlush (${asn(c.doFlush)})`, () => setDoFlush(!c.doFlush));
        yield button(`buffer (${asn(c.bufferedInputEnabled)})`, () => FL.setBufferedInputEnabled(!c.bufferedInputEnabled));

        yield buttonsRow([`Acts (${asn(c.bufferActions)})`, '+ defer', '- defer', 'flush'],
            (idx, _) => [
                DE.setbufferActions(!c.bufferActions),
                FL.setDeferRender(c.deferRender + 200),
                FL.setDeferRender(c.deferRender - 200),
                FL.flush()
            ][idx]);


        yield buttonsRow([...apps, 'none'],
            (idx, _) => setActiveApp(
                [...apps, undefined][idx] as ActiveApp
            ));
    }
);
