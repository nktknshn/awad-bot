export const currentComponent: {
    current: {
        state: any[],
        index: number
    }
} = {
    current: {
        state: [],
        index: 0
    }
}

export function useState<T>(initialValue: T): [() => T, (value: T) => Promise<void>] {
    console.log('useState');

    if (currentComponent.current.state.length >
        currentComponent.current.index) {
        
    } else {
        currentComponent.current.state.push(initialValue)
    }

    const index = currentComponent.current.state.length - 1
    currentComponent.current.index += 1
    
    return [
        () => currentComponent.current.state[index],
        async value => { currentComponent.current.state[index] = value }
    ]
}
