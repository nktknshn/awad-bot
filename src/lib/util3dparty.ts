
export class ObjectHelper {
    /**
     * Deep copy function for TypeScript.
     * @param T Generic type of target/copied value.
     * @param target Target value to be copied.
     * @see Source project, ts-deeply https://github.com/ykdr2017/ts-deepcopy
     * @see Code pen https://codepen.io/erikvullings/pen/ejyBYg
     */
    public static deepCopy<T>(target: T): T {
        if (target === null) {
            return target
        }
        if (target instanceof Date) {
            return new Date(target.getTime()) as any
        }
        // First part is for array and second part is for Realm.Collection
        // if (target instanceof Array || typeof (target as any).type === 'string') {
        if (typeof target === 'object') {
            if (typeof (target as { [key: string]: any })[(Symbol as any).iterator] === 'function') {
                const cp = [] as any[]
                if ((target as any as any[]).length > 0) {
                    for (const arrayMember of target as any as any[]) {
                        cp.push(ObjectHelper.deepCopy(arrayMember))
                    }
                }
                return cp as any as T
            } else {
                const targetKeys = Object.keys(target)
                const cp = {} as { [key: string]: any };
                if (targetKeys.length > 0) {
                    for (const key of targetKeys) {
                        cp[key] = ObjectHelper.deepCopy((target as { [key: string]: any })[key])
                    }
                }
                return cp as T
            }
        }
        // Means that object is atomic
        return target
    }
}

// import equal from 'fast-deep-equal'
function isFunction(functionToCheck: any): functionToCheck is Function {
    return typeof functionToCheck === 'function'
}

function equal(a: any, b: any) {
    if (a === b) return true;

    if (a && b && typeof a == 'object' && typeof b == 'object') {
        if (a.constructor !== b.constructor) return false;

        var length, i, keys;
        if (Array.isArray(a)) {
            length = a.length;
            if (length != b.length) return false;
            for (i = length; i-- !== 0;)
                if (!equal(a[i], b[i])) return false;
            return true;
        }

        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;

        for (i = length; i-- !== 0;)
            if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

        for (i = length; i-- !== 0;) {
            var key = keys[i];

            if (!equal(a[key], b[key])) return false;
        }

        return true;
    }

    if (isFunction(a) && isFunction(b))
        return true

    // true if both NaN, false otherwise
    return a !== a && b !== b;
};

export {
    equal
}