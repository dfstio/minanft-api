import {
  KMS,
  EncryptCommandInput,
  EncryptCommand,
  DecryptCommandInput,
  DecryptCommand,
} from "@aws-sdk/client-kms";

export async function encrypt(
  item: string,
  username: string
): Promise<string | undefined> {
  //console.log("KMS: encrypt", item, username);
  try {
    const client = new KMS({});
    const params = {
      KeyId: process.env.AWS_KMS_ENCRYPTION_KEY_ID!,
      Plaintext: Buffer.from(item, "utf8"),
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
  username: string
): Promise<string | undefined> {
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
      const result = Buffer.from(data.Plaintext).toString("utf8");
      //console.log("Success: KMS: decrypt result", result);
      return result;
    } else return undefined;
  } catch (error: any) {
    throw Error(`Error: KMS: decrypt ${error}`);
  }
}
