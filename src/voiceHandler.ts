import VoiceData from "./model/voiceData";
import axios from "axios";
import S3File from "./storage/s3";
import oggToMP3 from "./voice/ElasticTranscoder";
import FormData from "form-data";
import callLambda from "./lambda/lambda";
import BotMessage from "./chatgpt/message";
import { initLanguages, getLanguage } from "./lang/lang";

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;

export default class VoiceHandler {
  voiceData: VoiceData;
  constructor(voiceData: VoiceData) {
    this.voiceData = voiceData;
  }

  public async copyVoiceToS3(id: string): Promise<string | undefined> {
    try {
      const botToken = process.env.BOT_TOKEN!;

      const fileId = this.voiceData.file_id;
      const filename = Date.now().toString();
      const key = id + "-" + filename;
      const telegramFileInfo: any = await axios.get(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
      );
      const filePath = telegramFileInfo.data.result.file_path;
      const file = new S3File(process.env.BUCKET_VOICEIN!, key + ".ogg");
      await file.upload(
        `https://api.telegram.org/file/bot${botToken}/${filePath}`,
        "audio/ogg"
      );
      console.log("Saved", key + ".ogg");
      await file.wait();
      console.log("OGG is uploaded:", filename);
      await sleep(1000);

      await oggToMP3(key);

      const mp3file = new S3File(process.env.BUCKET_VOICEOUT!, key + ".mp3");
      await mp3file.wait();
      console.log("MP3 is uploaded:", filename);
      await sleep(1000);

      let chatGPT = "";

      // Get audio metadata to retrieve size and type
      const getresponse = await mp3file.get();

      // Get read object stream
      const s3Stream = getresponse.Body;

      const formData = new FormData();

      // append stream with a file
      formData.append("file", s3Stream, {
        contentType: getresponse.ContentType, //voiceData.mime_type, 'audio/mp3'
        knownLength: getresponse.ContentLength, //voiceData.file_size, 149187,
        filename: key + ".mp3",
      });

      formData.append("model", "whisper-1");

      try {
        const response = await axios.post(
          "https://api.openai.com/v1/audio/transcriptions",
          formData,
          {
            headers: {
              Authorization: `Bearer ${CHATGPT_TOKEN}`,
              ...formData.getHeaders(),
            },
            maxBodyLength: 25 * 1024 * 1024,
          }
        );
        if (response && response.data && response.data.text) {
          console.log("ChatGPT transcript:", response.data.text);
          chatGPT = response.data.text;
          if (chatGPT == "") {
            console.log("Empty prompt");
            return undefined;
          }
          await initLanguages();
          const language = await getLanguage(id);
          const bot = new BotMessage(id, language);

          // "thankyouforprompt": "Thank you for your prompt: {{prompt}}"
          await bot.tmessage("thankyouforprompt", { prompt: chatGPT });
          return chatGPT;
        } else {
          console.error("Chat GPT error", response.data.error);
          return undefined;
        }
      } catch (error: any) {
        console.error("Voice error - ChatGPT transcript", error);
        return undefined;
      }
    } catch (error: any) {
      console.error("copyVoiceToS3", error);
      return undefined;
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
