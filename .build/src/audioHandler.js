"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const s3_1 = __importDefault(require("./storage/s3"));
const form_data_1 = __importDefault(require("form-data"));
const message_1 = __importDefault(require("./mina/message"));
const lang_1 = require("./lang/lang");
const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH;
class AudioHandler {
    constructor(voiceData) {
        this.voiceData = voiceData;
    }
    async copyAudioToS3(id, filenameString) {
        try {
            console.log("copyAudioToS3", id, filenameString);
            const botToken = process.env.BOT_TOKEN;
            const filename = Date.now().toString() + ".mp3";
            const fileId = this.voiceData.file_id;
            const key = id + "/" + filename;
            const request = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
            const telegramFileInfo = await axios_1.default.get(request);
            const filePath = telegramFileInfo.data.result.file_path;
            const file = new s3_1.default(process.env.BUCKET, key);
            await file.upload(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
            console.log("Saved", key);
            await file.wait();
            console.log("Audio file is ready:", filename);
            await sleep(500);
            let chatGPT = "";
            try {
                const getresponse = await file.get();
                const s3Stream = getresponse.Body;
                const formData = new form_data_1.default();
                formData.append("file", s3Stream, {
                    contentType: getresponse.ContentType,
                    knownLength: getresponse.ContentLength,
                    filename,
                });
                formData.append("model", "whisper-1");
                try {
                    const response = await axios_1.default
                        .post("https://api.openai.com/v1/audio/transcriptions", formData, {
                        headers: {
                            Authorization: `Bearer ${CHATGPT_TOKEN}`,
                            ...formData.getHeaders(),
                        },
                        maxBodyLength: 25 * 1024 * 1024,
                    });
                    if (response && response.data && response.data.text) {
                        console.log("whisper transcript:", response.data.text);
                        chatGPT = response.data.text;
                        if (chatGPT == "") {
                            console.log("Empty prompt");
                            return;
                        }
                        await (0, lang_1.initLanguages)();
                        const language = await (0, lang_1.getLanguage)(id);
                        const bot = new message_1.default(id, language);
                        const str = chatGPT.match(/.{1,4000}/g);
                        if (str) {
                            console.log("Length", str.length);
                            let i;
                            for (i = 0; i < str.length; i++) {
                                await bot.message(str[i]);
                                await sleep(2000);
                            }
                        }
                        else
                            console.error("match error");
                    }
                }
                catch (e) {
                    console.error("whisper error - transcript", e);
                }
                ;
            }
            catch (error) {
                console.error("Audio error - getObject", error);
            }
        }
        catch (error) {
            console.error("Error: copyAudioToS3", error);
        }
    }
}
exports.default = AudioHandler;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=audioHandler.js.map