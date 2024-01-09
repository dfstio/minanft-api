import {
  ElasticTranscoderClient,
  CreateJobCommand,
} from "@aws-sdk/client-elastic-transcoder";

export default async function oggToMP3(key: string): Promise<void> {
  try {
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

    const elsticcommand = new CreateJobCommand(elasticParams);
    await elasticTranscoder.send(elsticcommand);
  } catch (error: any) {
    console.error("Error: oggToMP3", error);
  }
}
