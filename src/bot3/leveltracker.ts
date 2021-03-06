import levelup, { LevelUp } from 'levelup'
import leveldown, { LevelDown } from 'leveldown'
import { getTrackingRendererE, removeMessages, Tracker } from '../lib/chatrenderer';
import { flow, pipe } from 'fp-ts/lib/function';

export const levelDatabase = (path: string) => levelup(leveldown(path))

export const levelTracker = (trackerDb: LevelUp<LevelDown>): Tracker => ({
    trackRenderedMessage: async (chatId: number, messageId: number) => {
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
    untrackRenderedMessage: async (chatId: number, messageId: number) => {
        const messagesStr = await trackerDb.get(`chat: ${chatId}`)
        const messages: number[] = JSON.parse(messagesStr.toString())

        await trackerDb.put(
            `chat: ${chatId}`,
            JSON.stringify(messages.filter(_ => _ != messageId))
        )
    },
    getRenderedMessage: async (chatId: number) => {
        let messages: number[] = []
        const messagesStr = await trackerDb.get(`chat: ${chatId}`)

        messages = JSON.parse(messagesStr.toString())

        return messages
    },
})

export const createLevelTracker = flow(
    levelDatabase,
    levelTracker
)