import VoiceData from "./model/voiceData";
import axios from "axios";
import AWS from "aws-sdk";
import FormData from "form-data";
import BotMessage from "./mina/message";
import { initLanguages, getLanguage } from './lang/lang'

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;

export default class AudioHandler {
  voiceData: VoiceData;
  constructor(voiceData: VoiceData) {
    this.voiceData = voiceData;
  }

  public async copyAudioToS3(
    id: string,
    filenameString: string,
  ): Promise<void> {
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
    const s3 = new AWS.S3();
    axios
      .get(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
        responseType: "arraybuffer",
      })
      .then((response) => {
        const buffer = Buffer.from(response.data, "binary");
        s3.putObject({
          Bucket: process.env.BUCKET!,
          Key: key, // "/"
          Body: buffer,
        }).promise();
      })
      .catch((e) => console.log(e));

    console.log("Saved", key);

    const params = {
      Bucket: process.env.BUCKET!,
      Key: key,
    };

    let finished = false;
    await sleep(500);
    while (!finished) {
      console.log("Waiting for Audio", filename);
      s3.headObject(params, function (err, data) {
        if (err) console.log("Audio file is not ready yet:", filename);
        else {
          finished = true;
          console.log("Audio file is ready:", filename, data);
        }
      });
      await sleep(500);
    }

    await sleep(500);
    let chatGPT = "";
    finished = false;
    // Get audio metadata to retrieve size and type
    s3.headObject(params, function (err, data) {
      if (err) {
        console.log("Audio error - headObject", params, err);
        return;
      }
      console.log("data", data);

      // Get read object stream
      const s3Stream = s3.getObject(params).createReadStream();

      const formData = new FormData();

      // append stream with a file
      formData.append("file", s3Stream, {
        contentType: data.ContentType, //voiceData.mime_type, 'audio/mp3'
        knownLength: data.ContentLength, //voiceData.file_size, 149187,
        filename,
      });

      formData.append("model", "whisper-1");

      axios
        .post("https://api.openai.com/v1/audio/transcriptions", formData, {
          headers: {
            Authorization: `Bearer ${CHATGPT_TOKEN}`,
            ...formData.getHeaders(),
          },
          maxBodyLength: 25 * 1024 * 1024,
        })
        .then((response) => {
          if (response && response.data && response.data.text) {
            console.log("whisper transcript:", response.data.text);
            chatGPT = response.data.text;
            finished = true;

            return;
          } else {
            console.error("whisper error", response.data.error);
            finished = true;
            return;
          }
        })
        .catch((e) => console.log("whisper error - transcript", e));
    });

    await initLanguages();
    const language = await getLanguage(id);

    await sleep(1000);
    while (!finished) {
      console.log("Waiting for Whisper");
      await sleep(2000);
    }
    await sleep(200);

    const bot = new BotMessage(id, language);
    if (chatGPT == "") {
      console.log("Empty prompt");
      return;
    }
    const str = chatGPT.match(/.{1,4000}/g);
    if (str) {
      console.log("Length", str.length);
      let i;
      for (i = 0; i < str.length; i++) {
        await bot.message(str[i]);
        await sleep(2000);
      }
    } else console.error("match error");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
