"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
const axios_1 = __importDefault(require("axios"));
class S3File {
    constructor(bucket, key) {
        const options = {};
        this._client = new client_s3_1.S3Client(options);
        this.bucket = bucket;
        this.key = key;
        console.log('S3File:', bucket, ':', key, 'region:', process.env.AWS_REGION);
    }
    get client() {
        return this._client;
    }
    async put(buffer) {
        try {
            const params = {
                Bucket: this.bucket,
                Key: this.key,
                Body: buffer
            };
            console.log('S3File: put', params);
            const command = new client_s3_1.PutObjectCommand(params);
            const data = await this._client.send(command);
            console.log('Success: S3File: put', data);
        }
        catch (error) {
            console.error('Error: S3File: put', error);
        }
    }
    async get() {
        try {
            const params = {
                Bucket: this.bucket,
                Key: this.key
            };
            console.log('S3File: get', params);
            const command = new client_s3_1.GetObjectCommand(params);
            const data = await this._client.send(command);
            console.log('Success: S3File: get', data);
            return data;
        }
        catch (error) {
            console.error('Error: S3File: get', error);
            return undefined;
        }
    }
    async getStream() {
        try {
            const params = {
                Bucket: this.bucket,
                Key: this.key,
            };
            console.log('S3File: getStream', params);
            const command = new client_s3_1.GetObjectCommand(params);
            const data = await this._client.send(command);
            console.log('Success: S3File: getStream', data);
            return data.Body;
        }
        catch (error) {
            console.error('Error: S3File: getStream', error);
            return undefined;
        }
    }
    async head() {
        try {
            const params = {
                Bucket: this.bucket,
                Key: this.key,
            };
            console.log('S3File: head', params);
            const command = new client_s3_1.HeadObjectCommand(params);
            const data = await this._client.send(command);
            console.log('Success: S3File: head', data);
            return true;
        }
        catch (error) {
            console.log('Error: S3File: head', error);
            return false;
        }
    }
    async wait(timeoutSec = 10) {
        try {
            let finished = false;
            const start = Date.now();
            while (!finished) {
                console.log('Waiting for file', this.key);
                const head = await this.head();
                if (head)
                    finished = true;
                else if (Date.now() - start > timeoutSec * 1000)
                    throw new Error('Error: S3File: Timeout');
                else
                    await sleep(500);
            }
        }
        catch (error) {
            console.error('Error: S3File: wait', error);
        }
    }
    async remove() {
        try {
            const params = {
                Bucket: this.bucket,
                Key: this.key
            };
            console.log('S3File: remove', params);
            const command = new client_s3_1.DeleteObjectCommand(params);
            const data = await this._client.send(command);
            console.log('Success: S3File: remove', data);
        }
        catch (error) {
            console.error('Error: S3File: remove', error);
        }
    }
    async copy(bucket, key) {
        try {
            const params = {
                Bucket: bucket,
                CopySource: `${this.bucket}/${this.key}`,
                Key: key
            };
            console.log('S3File: copy', params);
            const command = new client_s3_1.CopyObjectCommand(params);
            const data = await this._client.send(command);
            console.log('Success: S3File: copy', data);
        }
        catch (error) {
            console.error('Error: S3File: copy', error);
        }
    }
    async move(bucket, key) {
        try {
            await this.copy(bucket, key);
            await this.remove();
        }
        catch (error) {
            console.error('Error: S3File: move', error);
        }
    }
    async upload(url) {
        try {
            const response = await axios_1.default.get(url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            await this.put(buffer);
        }
        catch (error) {
            console.error('Error: S3File: upload', error);
        }
    }
}
exports.default = S3File;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=s3.js.map