"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const table_1 = __importDefault(require("./table"));
class Tasks extends table_1.default {
    async remove(id) {
        await super.remove({ id: id });
    }
}
exports.default = Tasks;
//# sourceMappingURL=tasks.js.map