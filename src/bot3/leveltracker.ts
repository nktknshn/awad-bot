

import levelup, { LevelUp } from 'levelup'
import leveldown, { LevelDown } from 'leveldown'
import { getTrackingRenderer, removeMessages, Tracker } from '../lib/chatrenderer';

export const createDatabase = (path: string) => levelup(leveldown(path))



export const LevelTracker = (trackerDb: LevelUp<LevelDown>): Tracker => ({
    addRenderedMessage: async (chatId: number, messageId: number) => {
        let messages: number[] = []
        try {
            const messagesStr = await trackerDb.get(`chat: ${chatId}`)
            messages = JSON.parse(messagesStr.toString())
        }
        catch (e) {
        }
        finally {
            await trackerDb.put(`chat: ${chatId}`, JSON.stringify([...messages, messageId]))
        }

    },
    removeRenderedMessage: async (chatId: number, messageId: number) => {
        const messagesStr = await trackerDb.get(`chat: ${chatId}`)
        const messages: number[] = JSON.parse(messagesStr.toString())

        await trackerDb.put(`chat: ${chatId}`, JSON.stringify(messages.filter(_ => _ != messageId)))
    },
    getRenderedMessage: async (chatId: number) => {
        let messages: number[] = []
        try {
            const messagesStr = await trackerDb.get(`chat: ${chatId}`)
            messages = JSON.parse(messagesStr.toString())
        }
        catch { }

        return messages
    },
})