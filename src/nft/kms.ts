import {
  KMS,
  EncryptCommandInput,
  EncryptCommand,
  DecryptCommandInput,
  DecryptCommand,
} from "@aws-sdk/client-kms";
import crypto from "crypto";

export async function encrypt(
  item: string | Buffer,
  username: string
): Promise<string | undefined> {
  //console.log("KMS: encrypt", item, username);
  try {
    const client = new KMS({});
    const params = {
      KeyId: process.env.AWS_KMS_ENCRYPTION_KEY_ID!,
      Plaintext: typeof item === "string" ? Buffer.from(item, "utf8") : item,
      EncryptionContext: { username },
    };
    //console.log("KMS: encrypt", params);
    const command = new EncryptCommand(params as EncryptCommandInput);
    const data = await client.send(command);
    //console.log("Success: KMS: encrypt", data);
    if (data !== undefined && data.CiphertextBlob !== undefined)
      return Buffer.from(data.CiphertextBlob).toString("base64");
    else return undefined;
  } catch (error: any) {
    throw Error(`Error: KMS: encrypt ${error}`);
  }
}

export async function decrypt(
  item: string,
  username: string,
  returnBuffer: boolean = false
): Promise<string | Buffer | undefined> {
  try {
    const client = new KMS({});
    const params = {
      KeyId: process.env.AWS_KMS_ENCRYPTION_KEY_ID!,
      CiphertextBlob: Buffer.from(item, "base64"),
      EncryptionContext: { username },
    };
    //console.log("KMS: encrypt", params);
    const command = new DecryptCommand(params as DecryptCommandInput);
    const data = await client.send(command);
    //console.log("Success: KMS: decrypt", data);
    if (data !== undefined && data.Plaintext !== undefined) {
      if (returnBuffer) return Buffer.from(data.Plaintext);
      else return Buffer.from(data.Plaintext).toString("utf8");
    } else return undefined;
  } catch (error: any) {
    throw Error(`Error: KMS: decrypt ${error}`);
  }
}

export async function encryptJSON(
  json: any,
  name: string
): Promise<string | undefined> {
  //const list = crypto.getCiphers();
  const data = JSON.stringify(json);
  const algorithm = "aes-256-cbc"; // Use AES 256-bit encryption
  const key = crypto.randomBytes(32); // Generate a random 32-byte key
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key), iv);
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const encryptedKey = await encrypt(key, name);
  return JSON.stringify({
    iv: iv.toString("hex"),
    key: encryptedKey,
    data: encrypted.toString("hex"),
  });
}

export async function decryptJSON(
  encryptedJSON: string,
  name: string
): Promise<any> {
  try {
    const data = JSON.parse(encryptedJSON);
    const key = await decrypt(data.key, name, true);
    if (key === undefined) throw Error("decryptJSON: key is undefined");
    let iv = Buffer.from(data.iv, "hex");
    let encryptedText = Buffer.from(data.data, "hex");
    let decipher = crypto.createDecipheriv("aes-256-cbc", key as Buffer, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
  } catch (error: any) {
    console.error(`Error: decryptJSON ${error}`);
  }
  return undefined;
}
