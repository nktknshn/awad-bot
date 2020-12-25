// import { Element } from "./types"

// type GetSetState<S> = {
//     getState: (initialState?: S) => S
//     setState: (state: Partial<S>) => Promise<void>
// }

// type ComponentGenerator<R = Element> = Generator<R, unknown, unknown>

// type CompConstructor<P, R> = ((props: P) => ComponentGenerator<R>)

// type CompConstructorWithState<P, R, S = never> = (props: P, getset: GetSetState<S>) => ComponentGenerator<R>

// interface ComponentStateless<P, R = Element> {
//     comp: CompConstructor<P, R>
//     props: P,
//     // state?: S,
//     // instance: () => ComponentGenerator
//     kind: 'component'
// }

// interface ComponentWithState<P, R = Element, S = never> {
//     comp: CompConstructorWithState<P, R, S>
//     props: P,
//     // state?: S,
//     // instance: () => ComponentGenerator
//     kind: 'component-with-state'
// }


// function Component<P>(comp: CompConstructor<P, Element>) {
//     return function (props: P): ComponentStateless<P, Element> {
//         return {
//             comp,
//             props,
//             kind: 'component'
//         }
//     }
// }


// function ComponentWithState<P, S>(comp: CompConstructorWithState<P, Element, S>) {
//     return function (props: P): ComponentWithState<P, Element, S> {
//         return {
//             comp,
//             props,
//             kind: 'component-with-state'
//         }
//     }
// }


// export class ObjectHelper {
//     /**
//      * Deep copy function for TypeScript.
//      * @param T Generic type of target/copied value.
//      * @param target Target value to be copied.
//      * @see Source project, ts-deeply https://github.com/ykdr2017/ts-deepcopy
//      * @see Code pen https://codepen.io/erikvullings/pen/ejyBYg
//      */
//     public static deepCopy<T>(target: T): T {
//         if (target === null) {
//             return target
//         }
//         if (target instanceof Date) {
//             return new Date(target.getTime()) as any
//         }
//         // First part is for array and second part is for Realm.Collection
//         // if (target instanceof Array || typeof (target as any).type === 'string') {
//         if (typeof target === 'object') {
//             if (typeof (target as { [key: string]: any })[(Symbol as any).iterator] === 'function') {
//                 const cp = [] as any[]
//                 if ((target as any as any[]).length > 0) {
//                     for (const arrayMember of target as any as any[]) {
//                         cp.push(ObjectHelper.deepCopy(arrayMember))
//                     }
//                 }
//                 return cp as any as T
//             } else {
//                 const targetKeys = Object.keys(target)
//                 const cp = {} as { [key: string]: any };
//                 if (targetKeys.length > 0) {
//                     for (const key of targetKeys) {
//                         cp[key] = ObjectHelper.deepCopy((target as { [key: string]: any })[key])
//                     }
//                 }
//                 return cp as T
//             }
//         }
//         // Means that object is atomic
//         return target
//     }
// }
