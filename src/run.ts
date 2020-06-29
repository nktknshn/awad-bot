import { Telegraf } from 'telegraf'
import { TelegrafContext } from 'telegraf/typings/context'

async function hearsHi(ctx: TelegrafContext) {
    await ctx.reply('sasi')
}

async function main() {

    if (!process.env.BOT_TOKEN){
        console.error('Missing BOT_TOKEN')
        return 
    }

    const bot = new Telegraf(process.env.BOT_TOKEN)

    bot.start(async (ctx) => await ctx.reply('Welcome!'))

    bot.help(async (ctx) => await ctx.reply('Send me a sticker'))
    
    bot.on('sticker', async (ctx) => await ctx.reply('👍'))
    
    bot.hears('hi', hearsHi)
    
    bot.on('sticker', async (ctx) => await ctx.reply('👍'))

    bot.on('message', async (ctx) => 
        await ctx.reply(`${ctx.message?.from?.username} said ${ctx.message?.text}`))

    console.log('Starting the bot')

    await bot.launch()

    console.log('Started')
}

main()