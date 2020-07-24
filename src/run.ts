import { Telegraf } from 'telegraf';
import { TelegrafContext } from 'telegraf/typings/context';
import { throws } from 'assert';
import { session } from 'telegraf';
import config from '../src/config';
import { LocalSession } from 'telegraf-session-local';

interface Word {
  word: string;
  description?: string;
  examples?: string[];
}

interface List {
  name: string;
  words: Word[];
}

interface BotUser {
  userId: number;
  addList(words: List): Promise<void>;
  getLists(): Promise<List[]>;

  addWord(word: Word): Promise<void>;
  getWords(): Promise<Word[]>;
}

interface BotDatabase {
  getUser(userId: number): Promise<BotUser | undefined>;
  createUser(userId: number): Promise<BotUser>;
  createList(name: string): Promise<List | undefined>; //if the word is saved uncategorized it goes to default
}

interface BotSession {
  createList(list: List): Promise<List>;
}
class UserWordList implements List {
  name: string;
  words: Word[];

  constructor(name: string) {
    this.name = name;
    this.words = [];
  }
}
class MemoryBotUser implements BotUser {
  userId: number;
  private words: Word[];
  private lists: List[];

  constructor(userId: number) {
    this.userId = userId;
    this.words = [];
    this.lists = [];
  }

  async addWord(word: Word): Promise<void> {
    this.words.push(word);
  }

  async addList(words: List): Promise<void> {
    this.lists.push(words);
  }

  async getWords(): Promise<Word[]> {
    return this.words;
  }

  async getLists(): Promise<List[]> {
    return this.lists;
  }
}

class MemoryDatabase implements BotDatabase {
  users: MemoryBotUser[];
  lists: UserWordList[];

  //   lists: MemoryBotUser.lists[];

  constructor() {
    this.users = [];
    this.lists = [];
    // this.lists = [];
  }

  async getUser(userId: number): Promise<BotUser | undefined> {
    return this.users.find((user) => user.userId == userId);
  }
  async createUser(userId: number): Promise<BotUser> {
    const user = new MemoryBotUser(userId);
    this.users.push(user);
    return user;
  }
  async createList(name: string): Promise<List> {
    const list = new UserWordList(name);
    this.lists.push(list);
    return list;
  }
}

const getWordsFromMessage = (message: string) => message;

const messageHandler = (database: BotDatabase) => async (
  ctx: TelegrafContext
) => {
  // parse the message and add the word to the database

  //list
  // if (ctx.message?.text === '/newlist'){
  // await ctx.reply(`What is a title for a new one?`)
  // if
  // const new_lists =

  // }

  if (ctx.message?.from && ctx.message?.text) {
    let user = await database.getUser(ctx.message.from.id);

    if (!user) user = await database.createUser(ctx.message.from.id);

    await user.addWord({ word: getWordsFromMessage(ctx.message.text) });
    const new_words = await user.getWords();

    await ctx.reply(`${ctx.message.from.username} added ${ctx.message.text}`);
    await ctx.reply(`His words are ${new_words.map((w) => w.word).join(', ')}`);
  }
};

async function main() {
  if (!process.env.BOT_TOKEN) {
    console.error('Missing BOT_TOKEN');
    return;
  }

  const database: BotDatabase = new MemoryDatabase();
  const bot = new Telegraf(process.env.BOT_TOKEN);
  //name of session property object
  const property = 'data';

  // const localSession = new LocalSessionOptions({
  //   state: { words: [] },
  // });
const sessionstorage: LocalSession<string> = new localStorage();


  bot.command('newlist', async (ctx: TelegrafContext) => {
    bot.use(LocalSession.storageMemory(new));
    await ctx.reply(`Tell me new title for one!`);

    bot.on('message', (ctx) => {});
  });

  // bot.start(async (ctx) => await ctx.reply('Welcome!'))
  // bot.help(async (ctx) => await ctx.reply('Send me a sticker'))
  // bot.on('sticker', async (ctx) => await ctx.reply('👍'))
  // bot.hears('hi', ctx => ctx.reply('sasi'))
  // bot.on('sticker', async (ctx) => await ctx.reply('👍'))
  bot.on('message', messageHandler(database));
  //   bot.on('');

  await bot.launch();

  console.log('Started...');
}

main();
