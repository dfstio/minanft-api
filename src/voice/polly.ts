import {
  PollyClient,
  StartSpeechSynthesisTaskCommand,
  StartSpeechSynthesisTaskCommandInput,
  StartSpeechSynthesisTaskCommandOutput,
  GetSpeechSynthesisTaskCommand,
  GetSpeechSynthesisTaskCommandInput,
} from "@aws-sdk/client-polly";
import { sleep } from "minanft";

const voices = {
  en: "Joanna",
  es: "Lucia",
  fr: "Celine",
  it: "Carla",
  tr: "Filiz",
  ar: "Zeina",
  nl: "Lisa",
  ca: "Arlet",
  zh: "Zhiyu",
  da: "Naja",
  de: "Marlene",
  ja: "Mizuki",
  ko: "Seoyeon",
  nb: "Liv",
  pl: "Ewa",
  pt: "Vitoria",
  ro: "Carmen",
  ru: "Tatyana",
  sv: "Astrid",
  cy: "Gwyneth",
};

export async function textToVoice(
  text: string,
  id: string,
  language: string
): Promise<string | undefined> {
  if (text.length === 0) return undefined;
  try {
    const polly = new PollyClient({});
    const voiceId = (voices as any)[language] ?? "Joanna";
    //console.log("textToVoice", { language, voiceId, text });

    const pollyParams: StartSpeechSynthesisTaskCommandInput = {
      OutputFormat: "mp3",
      OutputS3BucketName: process.env.BUCKET!,
      Text: text,
      TextType: "text",
      OutputS3KeyPrefix: "minanft-" + language + "-" + id,
      VoiceId: voiceId,
    };

    const command = new StartSpeechSynthesisTaskCommand(pollyParams);
    const response = await polly.send(command);
    const start = Date.now();
    const taskId = response.SynthesisTask?.TaskId;
    const url = response.SynthesisTask?.OutputUri;
    if (taskId === undefined || url === undefined) {
      console.error("Error: textToVoice taskId or url undefined", {
        response,
        language,
        voiceId,
      });
      return undefined;
    }
    const taskParams: GetSpeechSynthesisTaskCommandInput = {
      TaskId: taskId,
    };
    //console.log("Success: textToVoice", response);
    let count = 0;
    let delay = 5 * text.length;
    if (delay < 1000) delay = 1000;
    let taskStatus = response.SynthesisTask?.TaskStatus;
    let taskResponse = response;
    while (taskStatus !== "completed") {
      if (count > 20) {
        console.error("Error: textToVoice timeout", {
          count,
          response,
          taskResponse,
          language,
          voiceId,
        });
        return undefined;
      }
      if (taskStatus === "failed") {
        console.error("Error: textToVoice failed", {
          count,
          response,
          taskResponse,
          language,
          voiceId,
        });
        return undefined;
      }
      await sleep(delay);
      const command = new GetSpeechSynthesisTaskCommand(taskParams);
      taskResponse = await polly.send(command);
      taskStatus = taskResponse.SynthesisTask?.TaskStatus;
      if (taskStatus === undefined) {
        console.error("Error: textToVoice taskStatus undefined", {
          count,
          response,
          taskResponse,
          language,
          voiceId,
        });
        return undefined;
      }
      count++;
    }
    const elapsed = Date.now() - start;
    const rate = Math.round(elapsed / text.length);
    console.log("Success: textToVoice", {
      language,
      voiceId,
      count,
      url,
      elapsed,
      rate,
    });
    return url;
  } catch (error: any) {
    console.error("Error: textToVoice", error);
    return undefined;
  }
}

/*

import {
  PollyClient,
  SynthesizeSpeechCommand,
  SynthesizeSpeechCommandInput,
  SynthesizeSpeechCommandOutput,
  StartSpeechSynthesisTaskCommand,
} from "@aws-sdk/client-polly";


export async function textToVoice(
  text: string,
  language: string
): Promise<SynthesizeSpeechCommandOutput | undefined> {
  try {
    const polly = new PollyClient({});
    const voiceId = voices[language] ?? "Joanna";
    console.log("textToVoice", language, voiceId, text);

    const pollyParams: SynthesizeSpeechCommandInput = {
      OutputFormat: "ogg_vorbis",
      Text: text,
      TextType: "text",
      VoiceId: voiceId,
    };

    const command = new SynthesizeSpeechCommand(pollyParams);
    const response = await polly.send(command);
    console.log("Success: textToVoice", response);
    if (response.AudioStream === undefined) return undefined;
    return response;
  } catch (error: any) {
    console.error("Error: textToVoice", error);
    return undefined;
  }
}

*/
