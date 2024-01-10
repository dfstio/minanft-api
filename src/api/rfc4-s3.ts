import S3File from "../storage/s3";

export async function copyStringtoS3(str: string): Promise<string> {
  try {
    console.log("copyJSONtoS3");
    const filename = Date.now().toString() + ".json";
    const file = new S3File(process.env.BUCKET!, filename);
    await file.put(str, "application/json");
    console.log("Saved", filename);
    await file.wait();
    console.log("file is ready:", filename);
    return filename;
  } catch (error: any) {
    console.error("Error: copyJSONtoS3", error);
    return "";
  }
}
