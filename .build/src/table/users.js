"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const table_1 = __importDefault(require("./table"));
const questions_1 = __importDefault(require("../questions"));
class Users extends table_1.default {
    constructor(tableName) {
        super(tableName);
        this.formQuestions = new questions_1.default();
    }
    async getItem(id) {
        return await this.get({ id: id });
    }
    async getAccount(id) {
        const data = await this.get({ id: id });
        if (data === undefined)
            return undefined;
        return data.account;
    }
    async getDeployment(id) {
        const data = await this.get({ id: id });
        if (data === undefined)
            return undefined;
        return data.deployment;
    }
    async getCurrentLanguage(id) {
        const data = await this.get({ id: id });
        if (data === undefined)
            return "en";
        return data.language_code;
    }
    getExpAttrValue(shortName, answer, num) {
        return JSON.parse(`{":ans" : ${num},"${shortName}" : "${answer}"}`);
    }
    async updateAnswer(id, currAnswer, val) {
        const currFormQuestion = this.formQuestions.getCurrentQuestion(currAnswer);
        if (currFormQuestion && currFormQuestion.shortName) {
            const nextNum = currAnswer + 1;
            await this.updateData({ id: id, }, {
                '#A': 'currentAnswer',
                '#Q': currFormQuestion.name,
            }, this.getExpAttrValue(currFormQuestion.shortName, val, nextNum), `set #A = :ans, #Q = ${currFormQuestion.shortName}`);
        }
    }
    async resetAnswer(id) {
        await this.updateData({ id: id, }, {
            '#A': 'currentAnswer',
            '#U': 'username',
        }, {
            ":ans": 0,
            ":usr": "",
        }, `set #A = :ans, #U = :usr`);
    }
    ;
    async updateAccount(id, account) {
        await this.updateData({ id: id, }, {
            '#A': 'account',
        }, { ":acc": account }, `set #A = :acc`);
    }
    async updateUsage(id, usage) {
        await this.updateData({ id: id, }, {
            "#P": "prompt_tokens",
            "#C": "completion_tokens",
            "#T": "total_tokens",
        }, {
            ":p": usage.prompt_tokens,
            ":c": usage.completion_tokens,
            ":t": usage.total_tokens,
        }, `ADD #P :p, #C :c, #T :t`);
    }
    async updateImageUsage(id) {
        await this.updateData({ id: id, }, {
            '#I': 'images_created',
        }, { ":i": 1 }, `ADD #I :i`);
    }
    async updateDeployment(id, account) {
        await this.updateData({ id: id, }, {
            '#D': 'deployment',
        }, { ":dp": account }, `set #D = :dp`);
    }
    async increaseCounter(id, currAnswer) {
        const nextNum = currAnswer + 1;
        await this.updateData({ id: id, }, {
            '#A': 'currentAnswer',
        }, { ":ans": nextNum }, `set #A = :ans`);
    }
}
exports.default = Users;
//# sourceMappingURL=users.js.map