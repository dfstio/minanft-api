import axios from "axios";
import S3File from "./storage/s3";
import { FileData } from "./model/fileData";

async function copyTelegramImageToS3(
  id: string,
  filename: string,
  file_id: string,
  useFolder: boolean = true
): Promise<FileData | undefined> {
  try {
    const timeUploaded = Date.now();
    const botToken = process.env.BOT_TOKEN!;
    const telegramFileInfo: any = await axios.get(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${file_id}`
    );
    const filePath = telegramFileInfo.data.result.file_path;
    const key = useFolder ? id + "/" + filename : filename;
    const file = new S3File(process.env.BUCKET!, key);
    await file.upload(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`,
      "image/jpeg"
    );
    console.log("Saved", filename);
    await file.wait();
    console.log("File is uploaded:", filename);
    await sleep(1000);
    const metadata = await file.metadata();
    if (metadata === undefined) return undefined;
    return {
      id,
      filename,
      size: metadata.size,
      mimeType: "image/jpeg",
      timeUploaded,
    };
  } catch (error: any) {
    console.error("copyTelegramImageToS3", error);
    return undefined;
  }
}

async function copyAIImageToS3(params: {
  id: string;
  filename: string;
  url: string;
  ai?: boolean;
  mimeType?: string;
}): Promise<FileData | undefined> {
  const { id, filename, url, ai, mimeType } = params;
  try {
    console.log("copyAIImageToS3", id, filename, url, ai);
    const key = ai === true ? id + "/" + filename : filename;
    const file = new S3File(process.env.BUCKET!, key);
    await file.upload(url, mimeType ?? "image/png");
    console.log("Saved", filename);
    await file.wait();
    console.log("File is uploaded:", filename);
    await sleep(1000);
    const metadata = await file.metadata();
    if (metadata === undefined) return undefined;
    const timeUploaded = Date.now();
    return {
      id,
      filename,
      size: metadata.size,
      mimeType: "image/jpeg",
      timeUploaded,
    };
  } catch (error: any) {
    console.error("copyAIImageToS3", error);
    return undefined;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { copyTelegramImageToS3, copyAIImageToS3 };
