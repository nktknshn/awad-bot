export interface Card {
    word: string
    transcription?: string
    tags: string[]
    meanings: Meaning[]
    translations: string[]
}

export interface Meaning {
    description: string
    examples: string[]
}
