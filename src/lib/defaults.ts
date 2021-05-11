import { pipe } from "fp-ts/lib/function";
import * as CA from 'Lib/chatactions';
import { ComponentElement } from "Lib/component";
import * as FL from "Lib/components/actions/flush";
import { reloadInterface } from 'Lib/components/actions/misc';
import * as TR from "Lib/components/actions/tracker";
import * as AP from 'Lib/newapp';
import { WithComponent } from "Lib/newapp";
import { chatstateAction, storeReducer } from 'Lib/reducer';
import { StoreF2 } from 'Lib/storeF';
import { BasicAppEvent, Utils } from 'Lib/types-util';

interface ReloadOnStart {
    reloadOnStart: boolean
}

type DefaultState<K extends keyof any> =
    & FL.FlushState
    & TR.UseTrackingRenderer
    & Record<K, StoreF2<unknown, unknown>>
    & ReloadOnStart

export const withDefaults = ({
    reloadOnStart = true,
    deferRender = 1500,
    bufferedInputEnabled = false,
    bufferedOnce = false,
    doFlush = false,
} = {}) =>
    async () =>
    ({
        reloadOnStart,
        ...(await FL.withFlush({
            doFlush, deferRender, bufferedInputEnabled, bufferedOnce
        })())
    })


// type Ut<R, H, P, RootComp, Ext> = Utils<R, H, BasicAppEvent<R, H>,
//     WithComponent<P, RootComp> & Ext, RootComp>

export const setReloadOnStart = (reloadOnStart: boolean) =>
    chatstateAction<{ reloadOnStart: boolean }>(s =>
        ({ ...s, reloadOnStart })
    )

export const myDefaultBehaviour = <K extends keyof any = 'store'>(
    {
        // cleanPrevious = true,
        useTracking = true,
        deferActions = false,
        // , withStore = true 
    } = {}, storeKey: K = 'store' as K
) => <
    R extends DefaultState<K>, H, Ext, RootComp extends ComponentElement, P
>(u: Utils<R, H, BasicAppEvent<R, H>,
    WithComponent<P, RootComp> & Ext, RootComp>) => pipe(u
        , AP.defaultBuild
        // , a => withStore ? a.extendF(AP.attachStore(storeKey)) : a
        , a => a.extendF(AP.attachStore(storeKey))
        , AP.addReducer(_ => FL.flushReducer(
            _.actions([
                TR.untrackRendererElementsAction(),
                CA.flush
            ])))
        , AP.addReducer(_ => storeReducer(storeKey))
        , AP.extend(a => ({
            defaultMessageHandler: a.actions([
                CA.applyInputHandler,
                TR.saveToTrackerAction(),
                FL.addUserMessageIfNeeded(),
                CA.applyEffects,
                FL.deferredRender()
            ])
            , handleAction: a.actions([
                CA.applyActionHandler,
                CA.replyCallback,
                CA.applyEffects,
                deferActions ? FL.deferredRender() : CA.render,
                FL.flushIfNeeded(),
            ])
        }))
        , AP.extend(a => ({
            handleMessage: a.action(CA.chain(
                ({ tctx, chatdata }) =>
                    chatdata.reloadOnStart && CA.ifStart(tctx)
                        ? a.actionF(reloadInterface)
                        : a.ext.defaultMessageHandler))
        }))
        , AP.extend(_ => ({
            defaultInit: ({ cleanPrevious = true } = {}) => _.actions([
                CA.onTrue(useTracking, TR.initTrackingRenderer({ cleanPrevious })),
                _.ext.attachStore
            ])
        }))
        , AP.props({})
    )

/*

: Utils<R, H, BasicAppEvent<R, H>, Merge<WithReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | FL.Flush | undefined, R, H> & WithReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | undefined, R, H> & AP.WithComponent<P, RootComp> & Ext & {
    handleEvent: (ctx: CA.ChatActionContext<R, H, BasicAppEvent<R, H>>, event: BasicAppEvent<R, H>) => Promise<ChatState<R, H>>;
    handleAction: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    render(contextCreator: (cs: ChatState<R, H>) => StateReq<GetAllComps<RootComp>>, props: P): RenderFunc<R, H>;
    defaultMessageHandler: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    attachStore: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    reducer: ChatActionReducer<LocalStateAction<any> | ChatStateAction<ChatState<R, H>> | FL.Flush | Parameters<R["store"]["applyAction"]>[0] | undefined, R, H, BasicAppEvent<R, H>>
    handleMessage: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
    init: CA.AppChatAction<R, H, BasicAppEvent<R, H>>;
}, {
    props: {};
}>, RootComp, ApplicationUtil<R, H, BasicAppEvent<R, H>, RootComp>>
*/