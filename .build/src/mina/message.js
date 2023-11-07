"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const stripe_1 = require("../payments/stripe");
const lang_1 = require("../lang/lang");
const history_1 = __importDefault(require("../table/history"));
const HISTORY_TABLE = process.env.HISTORY_TABLE;
class BotMessage {
    constructor(id, language, token = process.env.BOT_TOKEN, supportId = process.env.SUPPORT_CHAT) {
        this.bot = new telegraf_1.Telegraf(token);
        this.id = id;
        this.supportId = supportId;
        this.history = new history_1.default(HISTORY_TABLE, id);
        this.T = (0, lang_1.getT)(language);
        this.bot.catch((err, ctx) => {
            console.error(`Telegraf error for ${ctx.updateType}`, err);
        });
    }
    async tmessage(msg, params = {}) {
        const msgTransalted = this.T(msg, params);
        this.bot.telegram.sendMessage(this.id, msgTransalted).catch((error) => {
            console.error(`Telegraf error`, error);
        });
        await this.history.add(msgTransalted);
        const supportMsg = `Message for ${this.id}: ${msgTransalted}`;
        this.bot.telegram.sendMessage(this.supportId, supportMsg).catch((error) => {
            console.error(`Telegraf error`, error);
        });
        console.log(supportMsg);
    }
    async message(msg) {
        this.bot.telegram.sendMessage(this.id, msg).catch((error) => {
            console.error(`Telegraf error`, error);
        });
        await this.history.add(msg);
        const supportMsg = `Message for ${this.id}: ${msg}`;
        this.bot.telegram.sendMessage(this.supportId, supportMsg).catch((error) => {
            console.error(`Telegraf error`, error);
        });
        console.log(supportMsg);
    }
    async support(msg) {
        this.bot.telegram.sendMessage(this.supportId, msg).catch((error) => {
            console.error(`Telegraf error`, error);
        });
        console.log("Support msg", msg);
    }
    async image(image, params) {
        this.bot.telegram.sendPhoto(this.id, image, params).catch((error) => {
            console.error(`Telegraf error`, error);
        });
    }
    async invoice(username, image) {
        this.bot.telegram
            .sendInvoice(this.id, (0, stripe_1.mintInvoice)(this.id, this.T, username, image))
            .catch((error) => {
            console.error(`Telegraf error`, error);
        });
    }
    async supportTicket() {
        this.bot.telegram
            .sendInvoice(this.id, (0, stripe_1.supportInvoice)(this.id, this.T))
            .catch((error) => {
            console.error(`Telegraf error`, error);
        });
    }
}
exports.default = BotMessage;
//# sourceMappingURL=message.js.map