import st from 'stacktrace-js'

interface State<C> {
    currentContext: C,
    filters: Filter[],
    lastF?: string
}

let state: State<{}> = {
    currentContext: {},
    filters: [],
}

type Filter = (s: string, sfs: st.StackFrame[]) => boolean

export function initLogging(filters: Filter[]) {
    state.filters = filters
}

export function mylog(...ss: string | any) {
    const frames = st.getSync()

    for (const s of ss) {
        let output = ""
        const str = s === undefined ? 'undefined ' : typeof s === 'string' ? s : JSON.stringify(s)
        const fpath = [frames[2].functionName, frames[1].functionName].join(" -> ")

        if (fpath != state.lastF) {
            output += "\n"
            output += fpath + "\n"
        }

        output += str.split('\n').map(_ => `${_}`).join("\n")

        // console.log()

        let logit = false;
        for (const f of state.filters) {
            if (f(output, frames.slice(1, frames.length)) == true) {
                logit = true
                break
            }
        }

        if (logit) {
            console.log(output)
            state.lastF = fpath
        }
    }
}