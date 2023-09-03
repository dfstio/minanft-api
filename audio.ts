import { Handler, Context, Callback } from "aws-lambda";
import VoiceData from "./src/model/voiceData";
import AudioHandler from "./src/audioHandler";
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;

const transcribe: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  try {
    //console.log("event", event);
    //const body = JSON.parse(event.body);
    console.log("Audio request:", event);

    if (
      event &&
      event.auth &&
      event.audio &&
      event.id &&
      event.auth === CHATGPTPLUGINAUTH
    ) {
      const audio = event.audio;
      console.log(
        "Audio  data:",
        audio.file_name,
        audio.duration,
        audio.file_size,
        audio.mime_type,
      );
      const audioData = <VoiceData>{
        mime_type: audio.mime_type,
        file_id: audio.file_id,
        file_size: audio.file_size,
      };

      const audioHandler = new AudioHandler(audioData);
      await audioHandler.copyAudioToS3(event.id, audio.file_name);
      await sleep(1000);
    }

    return 200;
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return 200;
  }
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { transcribe };
