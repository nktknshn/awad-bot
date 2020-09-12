import { flattenList } from "./utils"

test('flatten', () => {
    expect(flattenList([])).toHaveLength(0)

    expect(flattenList([[1]])).toEqual([1])

    expect(flattenList([[1,2,1],[3,4,4,3],[1]])).toEqual([1,2,1,3,4,4,3,1])

    // so the function works as intendant
})

