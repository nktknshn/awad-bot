import { createRenderTasks } from "../lib/rendertask"


function doTheActions(rendered: number[], next: number[]) {
    // const rendered = [1, 2, 3, 4, 5, 6, 9, 10]
    // let next = [7, 2, 4, 5, 6, 8]

    let result = [...rendered]
    let actions: string[] = []

    createRenderTasks(
        rendered,
        next,
        (a, b) => a == b,
        (item) => {
            actions.push('leave')
        },
        (item, newItem) => {
            result = result.map(v => v === item ? newItem : v)
            // console.log(`replace ${item} with ${newItem}`);
            actions.push('replace')
        },
        (item) => {
            result.splice(result.indexOf(item), 1)
            actions.push('delete')
        },
        (item) => {
            result.push(item)
            actions.push('create')
        }
    )

    return { actions, result }
}

test('render', () => {

    function check(a: number[], b: number[], expectedActions: string[]) {
        const { actions, result } = doTheActions(a, b)

        console.log(actions);
        console.log(result);

        expect(result).toEqual(b)
        expect(actions).toEqual(expectedActions)
    }

    check(
        [1, 2, 3, 4, 5, 6, 9, 10],
        [7, 2, 4, 5, 6, 8],
        [
            'replace',
            'leave',
            'delete',
            'leave',
            'leave',
            'leave',
            'replace',
            'delete',
        ]
    )

    check(
        [1, 2, 3, 4],
        [5, 6, 7],
        [
            'replace',
            'replace',
            'replace',
            'delete',
        ]
    )

    check(
        [1, 2, 3, 4],
        [5, 6, 1, 2, 3, 4, 7],
        [
            'replace',
            'replace',
            'replace',
            'replace',
            'create',
            'create',
            'create',
        ]
    )

    check(
        [1, 2, 3, 4, 5, 6],
        [7, 8, 9, 1, 2, 3, 4],
        [
            'replace',
            'replace',
            'replace',
            'replace',
            'replace',
            'replace',
            'create',
        ]
    )

    check(
        [1, 2, 3, 4],
        [5],
        [
            'replace',
            'delete',
            'delete',
            'delete',
        ]
    )

})
