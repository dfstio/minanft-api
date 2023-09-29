"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.send = void 0;
const botLogic_1 = __importDefault(require("./src/botLogic"));
const send = async (event, context, callback) => {
    try {
        const body = JSON.parse(event.body);
        console.log("Bot request:", body);
        const botLogic = new botLogic_1.default();
        await botLogic.activate(body);
        await sleep(1000);
        callback(null, {
            statusCode: 200,
            body: "ok",
        });
    }
    catch (error) {
        console.error("catch", error.toString());
        callback(null, {
            statusCode: 200,
            body: "ok",
        });
    }
};
exports.send = send;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=telegram.js.map