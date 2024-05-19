import VoiceData from "./model/voiceData";
import axios from "axios";
import S3File from "./storage/s3";
import FormData from "form-data";
import BotMessage from "./chatgpt/message";
import { initLanguages, getLanguage } from "./lang/lang";
import { splitMarkdown } from "./chatgpt/split";

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;

export default class AudioHandler {
  voiceData: VoiceData;
  constructor(voiceData: VoiceData) {
    this.voiceData = voiceData;
  }

  public async copyAudioToS3(
    id: string,
    filenameString: string
  ): Promise<void> {
    try {
      console.log("copyAudioToS3", id, filenameString);
      const botToken = process.env.BOT_TOKEN!;

      const filename = Date.now().toString() + ".mp3";
      const fileId = this.voiceData.file_id;
      const key = id + "/" + filename;
      const request = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
      //console.log("telegramFileInfo request", request);
      const telegramFileInfo: any = await axios.get(request);
      //console.log("telegramFileInfo", telegramFileInfo);
      const filePath = telegramFileInfo.data.result.file_path;
      const file = new S3File(process.env.BUCKET!, key);
      await file.upload(
        `https://api.telegram.org/file/bot${botToken}/${filePath}`,
        "audio/mp3"
      );
      console.log("Saved", key);
      await file.wait();
      console.log("Audio file is ready:", filename);
      await sleep(500);
      let chatGPT = "";

      try {
        // Get audio metadata to retrieve size and type
        const getresponse = await file.get();

        // Get read object stream
        const s3Stream = getresponse.Body;

        const formData = new FormData();

        // append stream with a file
        formData.append("file", s3Stream, {
          contentType: getresponse.ContentType, //voiceData.mime_type, 'audio/mp3'
          knownLength: getresponse.ContentLength, //voiceData.file_size, 149187,
          filename,
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
            console.log("whisper transcript:", response.data.text);
            chatGPT = response.data.text;
            if (chatGPT == "") {
              console.log("Empty prompt");
              return;
            }
            await initLanguages();
            const language = await getLanguage(id);
            const bot = new BotMessage(id, language);
            const parts = splitMarkdown(chatGPT);
            for (const part of parts) {
              await bot.message(part);
              await sleep(2000);
            }
          }
        } catch (e: any) {
          console.error("whisper error - transcript", e);
        }
      } catch (error: any) {
        console.error("Audio error - getObject", error);
      }
    } catch (error: any) {
      console.error("Error: copyAudioToS3", error);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
