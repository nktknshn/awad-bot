
import { clearChat } from "Lib/inputhandler"
import * as CA from 'Lib/chatactions'
import { BasicAppEvent } from "Lib/types-util"
import { hasOwnProperty, isObject, reducer } from "Lib/reducer"

export const reloadInterface = <R, H>() =>
    CA.sequence<R, H>([
        // CA.addRenderedUserMessage(), 
        clearChat, CA.render
    ])

