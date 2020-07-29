"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var telegraf_1 = require("telegraf");
var telegraf_session_local_1 = require("telegraf-session-local");
var UserWordList = /** @class */ (function () {
    function UserWordList(name) {
        this.name = name;
        this.words = [];
    }
    return UserWordList;
}());
var MemoryBotUser = /** @class */ (function () {
    function MemoryBotUser(userId) {
        this.userId = userId;
        this.words = [];
        this.lists = [];
    }
    MemoryBotUser.prototype.addWord = function (word) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.words.push(word);
                return [2 /*return*/];
            });
        });
    };
    MemoryBotUser.prototype.addList = function (words) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.lists.push(words);
                return [2 /*return*/];
            });
        });
    };
    MemoryBotUser.prototype.getWords = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.words];
            });
        });
    };
    MemoryBotUser.prototype.getLists = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.lists];
            });
        });
    };
    return MemoryBotUser;
}());
var MemoryDatabase = /** @class */ (function () {
    //   lists: MemoryBotUser.lists[];
    function MemoryDatabase() {
        this.users = [];
        this.lists = [];
        // this.lists = [];
    }
    MemoryDatabase.prototype.getUser = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.users.find(function (user) { return user.userId == userId; })];
            });
        });
    };
    MemoryDatabase.prototype.createUser = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                user = new MemoryBotUser(userId);
                this.users.push(user);
                return [2 /*return*/, user];
            });
        });
    };
    MemoryDatabase.prototype.createList = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var list;
            return __generator(this, function (_a) {
                list = new UserWordList(name);
                this.lists.push(list);
                return [2 /*return*/, list];
            });
        });
    };
    return MemoryDatabase;
}());
var getWordsFromMessage = function (message) { return message; };
var messageHandler = function (database) { return function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var user, new_words;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!(((_a = ctx.message) === null || _a === void 0 ? void 0 : _a.from) && ((_b = ctx.message) === null || _b === void 0 ? void 0 : _b.text))) return [3 /*break*/, 8];
                return [4 /*yield*/, database.getUser(ctx.message.from.id)];
            case 1:
                user = _c.sent();
                if (!!user) return [3 /*break*/, 3];
                return [4 /*yield*/, database.createUser(ctx.message.from.id)];
            case 2:
                user = _c.sent();
                _c.label = 3;
            case 3: return [4 /*yield*/, user.addWord({ word: getWordsFromMessage(ctx.message.text) })];
            case 4:
                _c.sent();
                return [4 /*yield*/, user.getWords()];
            case 5:
                new_words = _c.sent();
                return [4 /*yield*/, ctx.reply(ctx.message.from.username + " added " + ctx.message.text)];
            case 6:
                _c.sent();
                return [4 /*yield*/, ctx.reply("His words are " + new_words.map(function (w) { return w.word; }).join(', '))];
            case 7:
                _c.sent();
                _c.label = 8;
            case 8: return [2 /*return*/];
        }
    });
}); }; };
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var database, bot, property, localSession;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!process.env.BOT_TOKEN) {
                        console.error('Missing BOT_TOKEN');
                        return [2 /*return*/];
                    }
                    database = new MemoryDatabase();
                    bot = new telegraf_1.Telegraf(process.env.BOT_TOKEN);
                    property = 'data';
                    localSession = new telegraf_session_local_1["default"]({
                        state: { words: [] }
                    });
                    bot.command('newlist', function (ctx) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    bot.use(localSession.middleware(property));
                                    return [4 /*yield*/, ctx.reply("Tell me new title for one!")];
                                case 1:
                                    _a.sent();
                                    bot.on('message', function (ctx) { });
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    // bot.start(async (ctx) => await ctx.reply('Welcome!'))
                    // bot.help(async (ctx) => await ctx.reply('Send me a sticker'))
                    // bot.on('sticker', async (ctx) => await ctx.reply('👍'))
                    // bot.hears('hi', ctx => ctx.reply('sasi'))
                    // bot.on('sticker', async (ctx) => await ctx.reply('👍'))
                    bot.on('message', messageHandler(database));
                    //   bot.on('');
                    return [4 /*yield*/, bot.launch()];
                case 1:
                    //   bot.on('');
                    _a.sent();
                    console.log('Started...');
                    return [2 /*return*/];
            }
        });
    });
}
main();
