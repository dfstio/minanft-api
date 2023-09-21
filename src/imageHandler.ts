import axios from "axios";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

async function copyTelegramImageToS3(
  filename: string,
  file_id: string,
): Promise<void> {
  try {
    const botToken = process.env.BOT_TOKEN!;
    const telegramFileInfo: any = await axios.get(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${file_id}`,
    );
    const filePath = telegramFileInfo.data.result.file_path;
    const response = await axios
      .get(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
        responseType: "arraybuffer",
      });

    const buffer = Buffer.from(response.data, "binary");
    const input = {
      Bucket: process.env.BUCKET!,
      Key: filename,
      Body: buffer,
    }
    const client = new S3Client({});
    const putcommand = new PutObjectCommand(input);
    await client.send(putcommand);

    const params = {
      Bucket: process.env.BUCKET!,
      Key: filename,
    };

    let finished = false;
    await sleep(500);
    while (!finished) {
      console.log("Waiting for file", filename);
      const headcommand = new HeadObjectCommand(params);
      try {
        const headresponse = await client.send(headcommand);
        finished = true;
        console.log("File is uploaded:", filename, headresponse);
      }
      catch (e) {
        console.log("S3 upload is not ready yet:", filename);
        await sleep(500);
      }
    }
    await sleep(1000);
  }
  catch (error: any) {
    console.error('copyTelegramImageToS3', error);
  }
}

async function copyAIImageToS3(filename: string, url: string): Promise<void> {
  try {
    console.log("copyAIImageToS3", filename, url);
    const response = await axios
      .get(url, {
        responseType: "arraybuffer",
      });

    const buffer = Buffer.from(response.data, "binary");
    const input = {
      Bucket: process.env.BUCKET!,
      Key: filename,
      Body: buffer,
    }
    const client = new S3Client({});
    const putcommand = new PutObjectCommand(input);
    await client.send(putcommand);

    const params = {
      Bucket: process.env.BUCKET!,
      Key: filename,
    };

    let finished = false;
    await sleep(500);
    while (!finished) {
      console.log("Waiting for file", filename);
      const headcommand = new HeadObjectCommand(params);
      try {
        const headresponse = await client.send(headcommand);
        finished = true;
        console.log("File is uploaded:", filename, headresponse);
      }
      catch (e) {
        console.log("S3 upload is not ready yet:", filename);
        await sleep(500);
      }
    }
    await sleep(1000);
  }
  catch (error: any) {
    console.error('copyAIImageToS3', error);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { copyTelegramImageToS3, copyAIImageToS3 };
