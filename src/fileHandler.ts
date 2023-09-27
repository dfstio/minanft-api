import DocumentData from "./model/documentData";
import axios from "axios";
import S3File from "./storage/s3";

export default class FileHandler {
  documentData: DocumentData;
  constructor(documentData: DocumentData) {
    this.documentData = documentData;
  }

  public async copyFileToS3(folder?: string): Promise<void> {
    try {
      const botToken = process.env.BOT_TOKEN!;
      const fileId = this.documentData.file_id;
      const filename = this.documentData.file_name;
      const key = folder ? folder + "/" + filename : filename;
      const telegramFileInfo: any = await axios.get(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
      );
      const filePath = telegramFileInfo.data.result.file_path;
      const file = new S3File(process.env.BUCKET!, key);
      await file.upload(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
      console.log("Saved", key);
    } catch (error: any) {
      console.error('copyFileToS3', error);
    }
  }
}
