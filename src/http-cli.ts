import { program } from 'commander'
import Debug from 'debug'
import axios from 'axios'
import { readStdin } from './cli/utils'

Debug.enable('http-cli')

const log = Debug('http-cli')

interface BackendSuccess {
    kind: 'success'
    data: any
}

interface BackendError {
    kind: 'error'
    code: number
    text: string
}

const success = (data: any): BackendSuccess =>
    ({ data, kind: 'success' })
const error = (code: number, text: string): BackendError =>
    ({ code, text, kind: 'error' })

type Result = BackendError | BackendSuccess

class RemoteBackend {

    constructor(public readonly url: string) { }

    public get(entity: string): Promise<Result> {
        return axios.get(`${this.url}/${entity}`)
            .then(res => success(res.data))
            .catch(e => error(e.response.status, e.response.statusText))
    }
    
    public post(entity: string, data: any): Promise<Result> {
        return axios.post(`${this.url}/${entity}`, data)
            .then(res => success(res.data))
            .catch(e => error(e.response.status, e.response.statusText))
    }
}

async function main() {

    const backend = new RemoteBackend('http://kanash.in:3010')

    program
        .command('get <entity>')
        .action(async function (entity: string) {
            const result = await backend.get(entity)

            if (result.kind === 'success') {
                log('success')
                console.log(result.data);
            } else {
                log('error')
                console.error(result.code);
                console.error(result.text);
            }

        })

    program
        .command('post <entity>')
        .action(async function (entity: string) {
            const input = (await readStdin()).join('')

            const obj = JSON.parse(input)

            let objects: any[] = []

            if (Array.isArray(obj)) {
                objects = obj
            } else {
                objects = [obj]
            }

            for (const obj of objects) {
                log(`Posting`)
                log(obj)

                const result = await backend.post(entity, obj)

                if (result.kind === 'success') {
                    log('success')
                    // console.log(result.data);
                } else {
                    log('error')
                    console.error(result.code);
                    console.error(result.text);
                }
            }

        })
    program.parse(process.argv)
}

main()