"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribe = void 0;
const audioHandler_1 = __importDefault(require("./src/audioHandler"));
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH;
const transcribe = async (event, context, callback) => {
    try {
        console.log("Audio request:", event);
        if (event &&
            event.auth &&
            event.audio &&
            event.id &&
            event.auth === CHATGPTPLUGINAUTH) {
            const audio = event.audio;
            console.log("Audio  data:", audio.file_name, audio.duration, audio.file_size, audio.mime_type);
            const audioData = {
                mime_type: audio.mime_type,
                file_id: audio.file_id,
                file_size: audio.file_size,
            };
            const audioHandler = new audioHandler_1.default(audioData);
            await audioHandler.copyAudioToS3(event.id, audio.file_name);
            await sleep(1000);
        }
        return 200;
    }
    catch (error) {
        console.error("catch", error.toString());
        return 200;
    }
};
exports.transcribe = transcribe;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=audio.js.map