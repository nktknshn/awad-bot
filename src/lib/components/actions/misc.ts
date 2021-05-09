
import { clearChat } from "Lib/inputhandler"

export const reloadInterface = <R, H>() =>
    CA.sequence<R, H, BasicAppEvent<R, H>>([
        CA.addRenderedUserMessage(), clearChat, CA.render
    ])

import * as CA from 'Lib/chatactions'
import { BasicAppEvent } from "Lib/types-util"
