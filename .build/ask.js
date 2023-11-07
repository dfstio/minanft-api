"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.archetype = exports.image = exports.chatgpt = void 0;
const chatgpt_1 = __importDefault(require("./src/chatgpt/chatgpt"));
const message_1 = __importDefault(require("./src/mina/message"));
const lang_1 = require("./src/lang/lang");
const context_1 = require("./src/chatgpt/context");
const functions_1 = require("./src/chatgpt/functions");
const nft_1 = require("./src/nft/nft");
const imageHandler_1 = require("./src/imageHandler");
const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH;
const chatgpt = async (event, context, callback) => {
    try {
        console.log("ChatGPT ask request:", event);
        let result = {
            image: "",
            answerType: "text",
            text: "Authentification failed",
        };
        if (event && event.auth && event.id && event.auth === CHATGPTPLUGINAUTH) {
            await (0, lang_1.initLanguages)();
            const language = await (0, lang_1.getLanguage)(event.id);
            if (event.message) {
                const chat = new chatgpt_1.default(CHATGPT_TOKEN, language, context_1.context, functions_1.functions);
                result = await chat.message(event);
            }
            const bot = new message_1.default(event.id, language);
            if (result.answerType === "text") {
                if (result.text.length < 4000)
                    await bot.message(result.text);
                else if (result.text.length < 4000 * 2) {
                    await bot.message(result.text.substring(0, 4000));
                    await sleep(1000);
                    await bot.message(result.text.substring(4000, 4000 * 2));
                }
                else {
                    await bot.message(result.text.substring(0, 4000));
                    await sleep(1000);
                    await bot.message(result.text.substring(4000, 4000 * 2));
                    await sleep(1000);
                    await bot.message(result.text.substring(4000 * 2, 4000 * 3));
                }
            }
            if (result.answerType === "image")
                await bot.image(result.image, result.text);
            console.log("ChatGPT result answerType:", result.answerType, "text", result.text);
            await sleep(1000);
        }
        return 200;
    }
    catch (error) {
        console.error("catch", error.toString());
        return 200;
    }
};
exports.chatgpt = chatgpt;
const image = async (event, context, callback) => {
    try {
        console.log("ChatGPT ask request:", event);
        let result = {
            image: "",
            answerType: "text",
            text: "Authentification failed",
        };
        if (event && event.auth && event.auth === CHATGPTPLUGINAUTH) {
            if (event.message && event.id && event.username) {
                await (0, lang_1.initLanguages)();
                const language = await (0, lang_1.getLanguage)(event.id);
                const chat = new chatgpt_1.default(CHATGPT_TOKEN, language, context_1.context);
                result = await chat.image(event.message, event.id, event.username);
            }
            console.log("Image result", result);
            if (event.id && event.username && result.image !== "") {
                await (0, lang_1.initLanguages)();
                const language = await (0, lang_1.getLanguage)(event.id);
                const timeNow = Date.now();
                const filename = (0, nft_1.generateFilename)(timeNow) + ".jpg";
                await (0, imageHandler_1.copyAIImageToS3)(filename, result.image);
                await (0, nft_1.startDeployment)(event.id, language, timeNow, filename, event.username, event.creator);
            }
        }
        console.log("ChatGPT ask reply:", result.answerType, result.text);
        await sleep(1000);
        return 200;
    }
    catch (error) {
        console.error("catch", error.toString());
        return 200;
    }
};
exports.image = image;
const archetype = async (event, context, callback) => {
    try {
        console.log("ChatGPT ask archetype request:", event);
        let result = {
            image: "",
            answerType: "text",
            text: "Authentification failed",
        };
        await (0, lang_1.initLanguages)();
        const language = event.id ? await (0, lang_1.getLanguage)(event.id) : 'en';
        if (event && event.auth && event.auth === CHATGPTPLUGINAUTH) {
            if (event.message && event.id && event.username) {
                const chat = new chatgpt_1.default(CHATGPT_TOKEN, language, context_1.context);
                result = await chat.image(event.message, event.id, event.username, true);
            }
            console.log("Image result", result);
            if (event.id && event.username && result.image !== "") {
                const bot = new message_1.default(event.id, language);
                await bot.image(result.image, "ArchetypeNFT");
                await bot.message(result.text);
                const timeNow = Date.now();
                const filename = (0, nft_1.generateFilename)(timeNow) + ".jpg";
                await (0, imageHandler_1.copyAIImageToS3)(filename, result.image);
                await bot.tmessage("midjourney");
            }
        }
        console.log("ChatGPT ask reply:", result.answerType, result.text);
        await sleep(1000);
        return 200;
    }
    catch (error) {
        console.error("catch", error.toString());
        return 200;
    }
};
exports.archetype = archetype;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=ask.js.map