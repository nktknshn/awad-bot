import { toggleItem } from "./util"

test('toggleItem', () => {

    expect(toggleItem([], 1)).toEqual([1])
    expect(toggleItem([1], 1)).toEqual([])
    expect(toggleItem([1, 2, 3], 1)).toEqual([2, 3])
    expect(toggleItem([2, 3], 1)).toEqual([2, 3, 1])
})