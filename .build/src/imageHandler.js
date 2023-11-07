"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyAIImageToS3 = exports.copyTelegramImageToS3 = void 0;
const axios_1 = __importDefault(require("axios"));
const s3_1 = __importDefault(require("./storage/s3"));
async function copyTelegramImageToS3(filename, file_id) {
    try {
        const botToken = process.env.BOT_TOKEN;
        const telegramFileInfo = await axios_1.default.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${file_id}`);
        const filePath = telegramFileInfo.data.result.file_path;
        const file = new s3_1.default(process.env.BUCKET, filename);
        await file.upload(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
        console.log("Saved", filename);
        await file.wait();
        console.log("File is uploaded:", filename);
        await sleep(1000);
    }
    catch (error) {
        console.error('copyTelegramImageToS3', error);
    }
}
exports.copyTelegramImageToS3 = copyTelegramImageToS3;
async function copyAIImageToS3(filename, url) {
    try {
        console.log("copyAIImageToS3", filename, url);
        const file = new s3_1.default(process.env.BUCKET, filename);
        await file.upload(url);
        console.log("Saved", filename);
        await file.wait();
        console.log("File is uploaded:", filename);
        await sleep(1000);
    }
    catch (error) {
        console.error('copyAIImageToS3', error);
    }
}
exports.copyAIImageToS3 = copyAIImageToS3;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=imageHandler.js.map