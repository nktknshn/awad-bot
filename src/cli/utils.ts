import * as readline from 'readline';

export function readStdin() {
    return new Promise<string[]>((resolve, reject) => {
        let rl = readline.createInterface({ input: process.stdin, });

        var lines: string[] = [];
        rl.on('line', (line) => { lines.push(line) })
        rl.on('close', () => { resolve(lines) })
    })
}
