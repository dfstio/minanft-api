import axios from "axios";
import { S3 } from "aws-sdk";

async function copyTelegramImageToS3(
  filename: string,
  file_id: string,
): Promise<void> {
  const botToken = process.env.BOT_TOKEN!;

  const telegramFileInfo: any = await axios.get(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${file_id}`,
  );
  const filePath = telegramFileInfo.data.result.file_path;
  const s3 = new S3();
  axios
    .get(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
      responseType: "arraybuffer",
    })
    .then((response) => {
      const buffer = Buffer.from(response.data, "binary");
      s3.putObject({
        Bucket: process.env.BUCKET!,
        Key: filename,
        Body: buffer,
      }).promise();
    })
    .catch((e) => console.log(e));

  let finished: boolean = false;
  const params = {
    Bucket: process.env.BUCKET!,
    Key: filename,
  };

  while (!finished) {
    console.log("Waiting for S3 to upload", filename);
    s3.headObject(params, function (err: any, data: any) {
      if (err) console.log("S3 upload is not ready yet");
      else {
        finished = true;
        console.log("File is uploaded", filename);
      }
    });
    await sleep(1000);
  }
}

async function copyAIImageToS3(filename: string, url: string): Promise<void> {
  const s3 = new S3();
  console.log("copyAIImageToS3", filename, url);
  axios
    .get(url, {
      responseType: "arraybuffer",
    })
    .then((response) => {
      console.log("copyAIImageToS3 response");
      const buffer = Buffer.from(response.data, "binary");
      s3.putObject({
        Bucket: process.env.BUCKET!,
        Key: filename,
        Body: buffer,
      }).promise();
    })
    .catch((e) => console.log(e));

  let finished: boolean = false;
  const params = {
    Bucket: process.env.BUCKET!,
    Key: filename,
  };

  while (!finished) {
    console.log("Waiting for S3 to upload", filename);
    s3.headObject(params, function (err: any, data: any) {
      if (err) console.log("S3 upload is not ready yet");
      else {
        finished = true;
        console.log("File is uploaded", filename);
      }
    });
    await sleep(1000);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { copyTelegramImageToS3, copyAIImageToS3 };
