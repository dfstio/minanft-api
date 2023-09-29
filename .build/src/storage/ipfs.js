"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
class IPFS {
    constructor(token) {
        this.auth = "Bearer " + token;
    }
    async add(params) {
        try {
            var data = JSON.stringify(params);
            var config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: this.auth,
                },
            };
            const res = await axios_1.default.post("https://api.pinata.cloud/pinning/pinJSONToIPFS", data, config);
            return res.data.IpfsHash;
        }
        catch (err) {
            console.error(err);
            return undefined;
        }
    }
    async addLink(file) {
        try {
            console.log("addLink", file);
            const auth = this.auth;
            const client = new client_s3_1.S3Client({});
            const params = {
                Bucket: process.env.BUCKET,
                Key: file,
            };
            let finished = false;
            await sleep(500);
            while (!finished) {
                console.log("Waiting for S3", file);
                const headcommand = new client_s3_1.HeadObjectCommand(params);
                try {
                    const headresponse = await client.send(headcommand);
                    finished = true;
                    console.log("S3 is ready:", file, headresponse);
                }
                catch (e) {
                    console.log("S3 is not ready yet", file);
                    await sleep(500);
                }
            }
            const getcommand = new client_s3_1.GetObjectCommand(params);
            const getresponse = await client.send(getcommand);
            const s3Stream = getresponse.Body;
            const formData = new form_data_1.default();
            formData.append("file", s3Stream, {
                contentType: getresponse.ContentType,
                knownLength: getresponse.ContentLength,
                filename: file,
            });
            const response = await axios_1.default.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
                headers: {
                    Authorization: auth,
                    ...formData.getHeaders(),
                },
                maxBodyLength: 25 * 1024 * 1024,
            });
            console.log("addLink result:", response.data);
            if (response && response.data && response.data.IpfsHash) {
                return response.data.IpfsHash;
            }
            else {
                console.error("addLink error", response.data.error);
                return undefined;
            }
        }
        catch (err) {
            console.error("addLink error 2 - catch", err);
            return undefined;
        }
        return undefined;
    }
}
exports.default = IPFS;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=ipfs.js.map