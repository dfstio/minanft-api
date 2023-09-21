import VoiceData from "./model/voiceData";
import axios from "axios";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { ElasticTranscoderClient, CreateJobCommand } from '@aws-sdk/client-elastic-transcoder'
import FormData from "form-data";
import callLambda from "./lambda/lambda";
import BotMessage from "./mina/message";
import { initLanguages, getLanguage } from './lang/lang'

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;

export default class VoiceHandler {
  voiceData: VoiceData;
  constructor(voiceData: VoiceData) {
    this.voiceData = voiceData;
  }

  public async copyVoiceToS3(
    id: string,
    parentMessage: string,
  ): Promise<string | undefined> {
    try {
      const botToken = process.env.BOT_TOKEN!;

      const fileId = this.voiceData.file_id;
      const filename = Date.now().toString();
      const key = id + "-" + filename;
      const telegramFileInfo: any = await axios.get(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
      );
      const filePath = telegramFileInfo.data.result.file_path;
      const response = await axios
        .get(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
          responseType: "arraybuffer",
        });

      const buffer = Buffer.from(response.data, "binary");
      const input = {
        Bucket: process.env.BUCKET_VOICEIN!,
        Key: key + ".ogg", // "/"
        Body: buffer,
      }
      const client = new S3Client({});
      const putcommand = new PutObjectCommand(input);
      await client.send(putcommand);

      console.log("Saved", key + ".ogg");
      const elasticTranscoder = new ElasticTranscoderClient({});
      const elasticParams = {
        PipelineId: process.env.VOICE_PIPELINEID!, //voice
        Input: {
          Key: key + ".ogg",
        },
        Output: {
          Key: key + ".mp3",
          PresetId: "1351620000001-300020", // mp3 192k
        },
      };

      const oggparams = {
        Bucket: process.env.BUCKET_VOICEIN!,
        Key: key + ".ogg",
      }

      let finished = false;
      await sleep(500);
      while (!finished) {
        console.log("Waiting for OGG", filename);
        const headcommand = new HeadObjectCommand(oggparams);
        try {
          const headresponse = await client.send(headcommand);
          finished = true;
          console.log("OGG is uploaded:", filename, headresponse);
        }
        catch (e) {
          console.log("OGG upload is not ready yet:", filename);
          await sleep(500);
        }
      }
      await sleep(1000);

      finished = false;
      const elsticcommand = new CreateJobCommand(elasticParams);
      await elasticTranscoder.send(elsticcommand);

      // Set the parameters for the S3 getObject operation
      const mp3params = {
        Bucket: process.env.BUCKET_VOICEOUT!,
        Key: key + ".mp3", //"1686398067705.mp3",
      };

      await sleep(500);
      while (!finished) {
        console.log("Waiting for MP3", filename);
        const headcommand = new HeadObjectCommand(mp3params);
        try {
          const headresponse = await client.send(headcommand);
          finished = true;
          console.log("MP3 is uploaded:", filename, headresponse);
        }
        catch (e) {
          console.log("MP3 upload is not ready yet:", filename);
          await sleep(500);
        }
      }
      await sleep(1000);

      //await sleep(5000);
      let chatGPT = "";
      finished = false;

      // Get audio metadata to retrieve size and type
      const getcommand = new GetObjectCommand(mp3params);
      const getresponse = await client.send(getcommand);

      // Get read object stream
      const s3Stream = getresponse.Body

      const formData = new FormData();

      // append stream with a file
      formData.append("file", s3Stream, {
        contentType: getresponse.ContentType, //voiceData.mime_type, 'audio/mp3'
        knownLength: getresponse.ContentLength, //voiceData.file_size, 149187,
        filename: key + ".mp3",
      });

      formData.append("model", "whisper-1");

      try {
        const response = await axios
          .post("https://api.openai.com/v1/audio/transcriptions", formData, {
            headers: {
              Authorization: `Bearer ${CHATGPT_TOKEN}`,
              ...formData.getHeaders(),
            },
            maxBodyLength: 25 * 1024 * 1024,
          })
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
          await bot.tmessage("thankyouforprompt", { prompt: chatGPT })
          return chatGPT;
        } else {
          console.error("Chat GPT error", response.data.error);
          finished = true;
          return undefined;
        }
      } catch (error: any) {
        console.error("Voice error - ChatGPT transcript", error);
        return undefined;
      };
    } catch (error: any) {
      console.error("copyVoiceToS3", error);
      return undefined;
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
