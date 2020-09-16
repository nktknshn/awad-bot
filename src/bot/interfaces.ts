export interface Card {
    word: string
    transcription?: string
    tags: string[]
    meanings: Meaning[]
}

export interface Meaning {
    description: string
    examples: string[]
}
