import { ChatState, getUserMessages } from "./application";

export const withUserMessages = <R, H>(c: ChatState<R, H>) => ({ userMessages: getUserMessages(c) });
