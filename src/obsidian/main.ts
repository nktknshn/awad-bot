import { runbot } from "Lib/botmain";
import { createApplication } from "./obsidian";

runbot({
    app: createApplication({
        vaultPath: '/home/horn/Documents/my1'
    })
})