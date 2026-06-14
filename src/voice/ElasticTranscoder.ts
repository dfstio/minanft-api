// Voice-input transcoding via AWS Elastic Transcoder is DISABLED — the service is
// deprecated by AWS and @aws-sdk/client-elastic-transcoder is not provided by the
// Lambda runtime. Kept as a no-op stub so dead callers still type-check.
// import {
//   ElasticTranscoderClient,
//   CreateJobCommand,
// } from "@aws-sdk/client-elastic-transcoder";

export default async function oggToMP3(_key: string): Promise<void> {
  // try {
  //   const elasticTranscoder = new ElasticTranscoderClient({});
  //   const elasticParams = {
  //     PipelineId: process.env.VOICE_PIPELINEID!, //voice
  //     Input: {
  //       Key: _key + ".ogg",
  //     },
  //     Output: {
  //       Key: _key + ".mp3",
  //       PresetId: "1351620000001-300020", // mp3 192k
  //     },
  //   };
  //
  //   const elsticcommand = new CreateJobCommand(elasticParams);
  //   await elasticTranscoder.send(elsticcommand);
  // } catch (error: any) {
  //   console.error("Error: oggToMP3", error);
  // }
}
