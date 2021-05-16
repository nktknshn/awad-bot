import * as CA from 'Lib/chatactions';
import { chatStateAction, hasKind, reducer } from "Lib/reducer";
import { TelegrafContext } from "telegraf/typings/context";


export const asn = (a: boolean) => a ? 1 : 0;
export const userId = async (tctx: TelegrafContext) => ({
    userId: tctx.from?.id!,
});
const username = async (tctx: TelegrafContext) => ({
    username: tctx.from?.username,
});

export const apps = ['app3f', 'app5', 'app2', 'app8', 'obsidian'];

export type ActiveApp = 'app3f' | 'app5' | 'app2' | 'app8' | 'obsidian';

export const setActiveApp = (activeApp?: ActiveApp) => chatStateAction<{ activeApp?: ActiveApp; }>(s => ({ ...s, activeApp })
);

export const toggleInfo = () => chatStateAction<{ showInfo: boolean; }>(s => ({ ...s, showInfo: !s.showInfo })
);
type Refresh = { kind: 'refresh'; };
export const refresh = (): Refresh => ({ kind: 'refresh' });
type Clear = { kind: 'clear'; };
export const clear = (): Clear => ({ kind: 'clear' });
export const refreshReducer = <R, H>(action: CA.AppChatAction<R, H>) => reducer(
    hasKind<Refresh>('refresh'),
    _ => action
);
export const clearReducer = <R, H>(action: CA.AppChatAction<R, H>) => reducer(
    hasKind<Clear>('clear'),
    _ => action
);
