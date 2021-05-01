import { TelegrafContext } from 'telegraf/typings/context'
import { OutcomingTextMessage } from './textmessage';
import deq from 'fast-deep-equal';


export const parseFromContext = (ctx: TelegrafContext) => {
    let location: [number, number] | undefined;
    let action;
    let integer;
    let float;

    const messageText = ctx.message?.text

    if (ctx.message?.location)
        location = [
            ctx.message?.location.latitude,
            ctx.message?.location.longitude
        ]
    else if (messageText)
        location = parseLocation(messageText)

    if (ctx.match)
        action = ctx.match[0]

    if (messageText && !isNaN(parseInt(messageText)))
        integer = parseInt(messageText)

    if (messageText && !isNaN(parseFloat(messageText)))
        float = parseFloat(messageText)
    
    const photo = ctx.message?.photo

    return {
        messageText,
        location,
        action,
        integer,
        float,
        photo,
        ctx
    }
}

export function parseLocation(text: string) {
    for (const line of text.split('\n')) {
        const loc = getLocation(line)

        if (loc)
            return loc
    }
}

export function getLocation(line: string): [number, number] | undefined {
    const lat_lon = line.split(',')

    if (lat_lon.length == 2) {
        const [lat, lon] = lat_lon

        try {
            // return [Number.parseFloat(lat), Number.parseFloat(lon)]
            return [Number.parseFloat(lon), Number.parseFloat(lat)]
        } catch {
            return undefined
        }

    }
}

export function areSameTextMessages(a: OutcomingTextMessage, b: OutcomingTextMessage) {
    return a.text == b.text
        && deq(
            a.getExtra(),
            b.getExtra())
}