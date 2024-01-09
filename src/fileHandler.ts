import DocumentData from "./model/documentData";
import axios from "axios";
import S3File from "./storage/s3";
import { sleep } from "minanft";
import { FileData } from "./model/fileData";

export default class FileHandler {
  id: string;
  documentData: DocumentData;
  constructor(id: string, documentData: DocumentData) {
    this.documentData = documentData;
    this.id = id;
  }

  public async copyFileToS3(folder?: string): Promise<FileData | undefined> {
    try {
      const timeUploaded = Date.now();
      const botToken = process.env.BOT_TOKEN!;
      const fileId = this.documentData.file_id;
      const filename = this.documentData.file_name;
      const key = folder ? folder + "/" + filename : filename;
      const telegramFileInfo: any = await axios.get(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
      );
      const filePath = telegramFileInfo.data.result.file_path;
      const file = new S3File(process.env.BUCKET!, key);
      await file.upload(
        `https://api.telegram.org/file/bot${botToken}/${filePath}`
      );
      console.log("Saved", key);
      await file.wait();

      console.log("File is uploaded:", filename);
      await sleep(1000);
      const metadata = await file.metadata();
      if (metadata === undefined) return undefined;
      return {
        id: this.id,
        filename,
        size: metadata.size,
        mimeType: this.documentData.mime_type,
        timeUploaded,
      };
      console.log("Saved", key);
    } catch (error: any) {
      console.error("copyFileToS3", error);
      return undefined;
    }
  }
}
