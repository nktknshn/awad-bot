type Location = {
    description: string,
    gps: Gps,
    items: Item[],
    directions: Direction[],
    actions: Action[]
}

type Action = {

}

type Item = {
    title: string,
}

type Direction = {
    title: string,
    location: Location,
}

export type Gps = {
    x: number,
    y: number,
    z: number
}

type GameState = {

}