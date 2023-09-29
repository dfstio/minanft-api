"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const s3_1 = __importDefault(require("./storage/s3"));
const ElasticTranscoder_1 = __importDefault(require("./voice/ElasticTranscoder"));
const form_data_1 = __importDefault(require("form-data"));
const message_1 = __importDefault(require("./mina/message"));
const lang_1 = require("./lang/lang");
const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH;
class VoiceHandler {
    constructor(voiceData) {
        this.voiceData = voiceData;
    }
    async copyVoiceToS3(id, parentMessage) {
        try {
            const botToken = process.env.BOT_TOKEN;
            const fileId = this.voiceData.file_id;
            const filename = Date.now().toString();
            const key = id + "-" + filename;
            const telegramFileInfo = await axios_1.default.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
            const filePath = telegramFileInfo.data.result.file_path;
            const file = new s3_1.default(process.env.BUCKET_VOICEIN, key + ".ogg");
            await file.upload(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
            console.log("Saved", key + ".ogg");
            await file.wait();
            console.log("OGG is uploaded:", filename);
            await sleep(1000);
            await (0, ElasticTranscoder_1.default)(key);
            const mp3file = new s3_1.default(process.env.BUCKET_VOICEOUT, key + ".mp3");
            await mp3file.wait();
            console.log("MP3 is uploaded:", filename);
            await sleep(1000);
            let chatGPT = "";
            const getresponse = await mp3file.get();
            const s3Stream = getresponse.Body;
            const formData = new form_data_1.default();
            formData.append("file", s3Stream, {
                contentType: getresponse.ContentType,
                knownLength: getresponse.ContentLength,
                filename: key + ".mp3",
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
                    console.log("ChatGPT transcript:", response.data.text);
                    chatGPT = response.data.text;
                    if (chatGPT == "") {
                        console.log("Empty prompt");
                        return undefined;
                    }
                    await (0, lang_1.initLanguages)();
                    const language = await (0, lang_1.getLanguage)(id);
                    const bot = new message_1.default(id, language);
                    await bot.tmessage("thankyouforprompt", { prompt: chatGPT });
                    return chatGPT;
                }
                else {
                    console.error("Chat GPT error", response.data.error);
                    return undefined;
                }
            }
            catch (error) {
                console.error("Voice error - ChatGPT transcript", error);
                return undefined;
            }
            ;
        }
        catch (error) {
            console.error("copyVoiceToS3", error);
            return undefined;
        }
    }
}
exports.default = VoiceHandler;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=voiceHandler.js.map