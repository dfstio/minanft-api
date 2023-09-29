"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const table_1 = __importDefault(require("./table"));
const openai_1 = require("openai");
const HISTORY_HOURS = Number(process.env.HISTORY_HOURS);
const HISTORY_CHARS = Number(process.env.HISTORY_CHARS);
class History extends table_1.default {
    constructor(tableName, id) {
        super(tableName);
        this.id = id;
    }
    async add(msg, isUser = false) {
        const message = {
            role: isUser
                ? openai_1.ChatCompletionRequestMessageRoleEnum.User
                : openai_1.ChatCompletionRequestMessageRoleEnum.Assistant,
            content: msg,
        };
        await this.addAnswer(message);
    }
    async addAnswer(message) {
        await this.create({
            id: this.id,
            time: Date.now(),
            message: message,
        });
    }
    async query() {
        return await this.queryData("id = :id", { ":id": this.id });
    }
    async remove(time) {
        await super.remove({ id: this.id, time: time });
    }
    async build(context, request) {
        let history = await this.query();
        let messages = [];
        let size = 0;
        for (const msg of context) {
            const msgSize = (msg.content || "").length;
            size += msgSize;
            messages.push(msg);
        }
        for (const msg of request) {
            const msgSize = (msg.content || "").length;
            size += msgSize;
        }
        const count = history.length;
        history.sort((a, b) => b.time - a.time);
        console.log("history: ", history);
        const timeLimit = Date.now() - HISTORY_HOURS * 60 * 60 * 1000;
        let subset = [];
        for (const item of history) {
            const msgSize = (item.message.content || "").length;
            if (item.time > timeLimit && size + msgSize < HISTORY_CHARS) {
                size += msgSize;
                subset.push(item);
            }
            else
                await this.remove(item.time);
        }
        subset.sort((a, b) => a.time - b.time);
        for (const item of subset) {
            messages.push(item.message);
        }
        for (const msg of request) {
            messages.push(msg);
        }
        return messages;
    }
}
exports.default = History;
//# sourceMappingURL=history.js.map