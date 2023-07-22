import VoiceData from "./model/voiceData";
import axios from "axios";
import AWS from "aws-sdk";
import FormData from "form-data";
import callLambda from "./mina/lambda";
import BotMessage from "./mina/message";

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
        const botToken = process.env.BOT_TOKEN!;

        const fileId = this.voiceData.file_id;
        const filename = Date.now().toString();
        const key = id + "-" + filename;
        const telegramFileInfo: any = await axios.get(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
        );
        const filePath = telegramFileInfo.data.result.file_path;
        const s3 = new AWS.S3();
        axios
            .get(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
                responseType: "arraybuffer",
            })
            .then((response) => {
                const buffer = Buffer.from(response.data, "binary");
                s3.putObject({
                    Bucket: process.env.BUCKET_VOICEIN!,
                    Key: key + ".ogg", // "/"
                    Body: buffer,
                }).promise();
            })
            .catch((e) => {
                console.log(e);
                return undefined;
            });

        console.log("Saved", key + ".ogg");
        const elasticTranscoder = new AWS.ElasticTranscoder();
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

        let finished = false;
        await sleep(500);
        while (!finished) {
            console.log("Waiting for OGG");
            s3.headObject(
                {
                    Bucket: process.env.BUCKET_VOICEIN!,
                    Key: key + ".ogg",
                },
                function (err, data) {
                    if (err) console.log("OGG is not ready yet");
                    else {
                        finished = true;
                        console.log("OGG is ready", data);
                    }
                },
            );
            await sleep(500);
        }

        finished = false;
        elasticTranscoder.createJob(elasticParams, function (err, data) {
            if (err) console.log("AWS.ElasticTranscoder error", err, err.stack);
            // an error occurred
            else {
                console.log("AWS.ElasticTranscoder", data); // successful response
                finished = true;
            }
        });

        // Set the parameters for the S3 getObject operation
        const params = {
            Bucket: process.env.BUCKET_VOICEOUT!,
            Key: key + ".mp3", //"1686398067705.mp3",
        };

        while (!finished) {
            console.log("Waiting for AWS.ElasticTranscoder");
            await sleep(500);
        }

        finished = false;
        await sleep(1000);
        while (!finished) {
            console.log("Waiting for MP3");
            s3.headObject(params, function (err, data) {
                if (err) console.log("MP3 is not ready yet");
                else {
                    finished = true;
                    console.log("MP3 is ready", data);
                }
            });
            await sleep(1000);
        }

        //await sleep(5000);
        let chatGPT = "";
        finished = false;
        // Get audio metadata to retrieve size and type
        s3.headObject(params, function (err, data) {
            if (err) {
                console.log("Voice error - headObject", params, err);
                return undefined;
            }
            console.log("data", data);

            // Get read object stream
            const s3Stream = s3.getObject(params).createReadStream();

            const formData = new FormData();

            // append stream with a file
            formData.append("file", s3Stream, {
                contentType: data.ContentType, //voiceData.mime_type, 'audio/mp3'
                knownLength: data.ContentLength, //voiceData.file_size, 149187,
                filename: key + ".mp3",
            });

            formData.append("model", "whisper-1");

            axios
                .post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${CHATGPT_TOKEN}`,
                            ...formData.getHeaders(),
                        },
                        maxBodyLength: 25 * 1024 * 1024,
                    },
                )
                .then((response) => {
                    if (response && response.data && response.data.text) {
                        console.log("ChatGPT transcript:", response.data.text);
                        chatGPT = response.data.text;
                        finished = true;
                    } else {
                        console.error("Chat GPT error", response.data.error);
                        finished = true;
                        return undefined;
                    }
                })
                .catch((e) => {
                    console.log("Voice error - ChatGPT transcript", e);
                    return undefined;
                });
        });
        await sleep(500);
        while (!finished) {
            console.log("Waiting for Whisper");
            await sleep(500);
        }
        await sleep(200);
        const bot = new BotMessage(id);
        if (chatGPT == "") {
            console.log("Empty prompt");
            return undefined;
        }

        await bot.message(`Thank you for your prompt: ${chatGPT}`);
        return chatGPT;
        /*
    await callLambda(
      "ask",
      JSON.stringify({
        id: id,
        message: chatGPT,
        parentMessage: parentMessage,
        image: "",
        auth: CHATGPTPLUGINAUTH,
      }),
    );
    */
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
