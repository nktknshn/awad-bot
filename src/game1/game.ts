type Home = {
    locationKind: 'Home'
    gps: Gps
}

type Street = {
    locationKind: 'Street'
    gps: Gps
}

type Subway = {
    locationKind: 'Subway'
    gps: Gps
}

type Bus = {
    locationKind: 'Bus'
    gps: Gps
}

type Gps = {
    x: number,
    y: number,
    z: number
}


export type Location = Home | Street | Subway | Bus