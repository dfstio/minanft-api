"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const table_1 = __importDefault(require("./table"));
class Names extends table_1.default {
    async updateDeploy(username, data) {
        await this.updateData({
            username: username,
        }, { '#D': 'deploy' }, { ':data': data }, 'set #D = :data');
    }
    async updateUri(username, ipfs, uri) {
        await this.updateData({ username: username }, { "#I": 'ipfs', '#U': 'uri' }, { ':ipfs': ipfs, ':uri': uri }, 'set #I = :ipfs, #U = :uri');
    }
    async sell(username, price, currency) {
        await this.updateData({ username: username }, { "#P": 'price', '#C': 'currency', '#S': 'onSale' }, {
            ':p': price,
            ':c': currency.toLowerCase(),
            ':s': true,
        }, 'set #P = :p, #C = :c, #S = :s');
    }
}
exports.default = Names;
//# sourceMappingURL=names.js.map