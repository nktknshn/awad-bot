import { CheckList, CheckListBody } from "./checklist"
import { ComponentGenerator } from "../types"
import { componentToElements, elementsToMessagesAndHandlers } from "../component"


function componentToArray(comp: ComponentGenerator) {
    let result = []

    for(const el of comp) {
        result.push(el)
    }

    return result
}

test('checklist', () => {
    const comp = CheckListBody({
        items: [
            'option one',
            'second option',
            'and third one',
            'also 4th',
            'lenovo thinkpad'
        ],
        selectedIds: [0, 1, 4]
    })
    
    console.log(
        elementsToMessagesAndHandlers(comp)
    );
    
})