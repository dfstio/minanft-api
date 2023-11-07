"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_elastic_transcoder_1 = require("@aws-sdk/client-elastic-transcoder");
async function oggToMP3(key) {
    try {
        const elasticTranscoder = new client_elastic_transcoder_1.ElasticTranscoderClient({});
        const elasticParams = {
            PipelineId: process.env.VOICE_PIPELINEID,
            Input: {
                Key: key + ".ogg",
            },
            Output: {
                Key: key + ".mp3",
                PresetId: "1351620000001-300020",
            },
        };
        const elsticcommand = new client_elastic_transcoder_1.CreateJobCommand(elasticParams);
        await elasticTranscoder.send(elsticcommand);
    }
    catch (error) {
        console.error("Error: oggToMP3", error);
    }
}
exports.default = oggToMP3;
//# sourceMappingURL=ElasticTranscoder.js.map