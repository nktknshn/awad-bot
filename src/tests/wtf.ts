import { If } from "Lib/types-util"

const abc = <
    A,
    B extends A,
    C extends If<B, unknown, A, B> = If<B, unknown, A, B>
>(
    a: A
    , f: (b: C) => void
    , f2: (b: C) => void
    , f3: (b: C) => void
) => {}


const func = <B>(f: (b: B) => void) => (b: B) => f(b)

abc(
    "b"
    // bbbbb: unknown
    , func(bbbbb => {})
    // bbbbb: string
    , bbbbb => {}
    // bbbbb: string
    , func(bbbbb => {})
)
