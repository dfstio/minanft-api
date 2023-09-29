"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const s3_1 = __importDefault(require("./storage/s3"));
class FileHandler {
    constructor(documentData) {
        this.documentData = documentData;
    }
    async copyFileToS3(folder) {
        try {
            const botToken = process.env.BOT_TOKEN;
            const fileId = this.documentData.file_id;
            const filename = this.documentData.file_name;
            const key = folder ? folder + "/" + filename : filename;
            const telegramFileInfo = await axios_1.default.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
            const filePath = telegramFileInfo.data.result.file_path;
            const file = new s3_1.default(process.env.BUCKET, key);
            await file.upload(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
            console.log("Saved", key);
        }
        catch (error) {
            console.error('copyFileToS3', error);
        }
    }
}
exports.default = FileHandler;
//# sourceMappingURL=fileHandler.js.map