import axios from "axios";
import S3File from "./storage/s3";

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
    const file = new S3File(process.env.BUCKET!, filename);
    await file.upload(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    console.log("Saved", filename);
    await file.wait()
    console.log("File is uploaded:", filename);
    await sleep(1000);
  }
  catch (error: any) {
    console.error('copyTelegramImageToS3', error);
  }
}

async function copyAIImageToS3(filename: string, url: string): Promise<void> {
  try {
    console.log("copyAIImageToS3", filename, url);
    const file = new S3File(process.env.BUCKET!, filename);
    await file.upload(url);
    console.log("Saved", filename);
    await file.wait()
    console.log("File is uploaded:", filename);
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
