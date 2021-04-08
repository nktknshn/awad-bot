import { BasicElement, ComponentElement, ComponentGenerator, isComponentElement } from "./elements"
import * as Tree from 'fp-ts/Tree'
import { AppReqs, GetAllBasics } from "./types-util"
import { Store } from 'redux'

type ElementsTree = Tree.Tree<ComponentElement | BasicElement>

function executeRoot<
    P,
    S extends SR,
    C extends ComponentElement,
    SR extends AppReqs<C>
>
    (
        rootComponent: (props: P) => C,
        rootProps: P,
        store: Store<S>
    ) {

        const comp = rootComponent(rootProps)

}