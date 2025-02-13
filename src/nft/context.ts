import { encrypt, decrypt } from "./kms";

export async function getContext(item: string): Promise<string> {
  if (item === undefined) throw new Error("getContext: item is undefined");
  const context = process.env.CONTEXT_KEY;
  if (context === undefined)
    throw new Error("getContext: CONTEXT_KEY is not set");
  const decrypted = await decrypt(item, context);
  if (decrypted === undefined) throw new Error("Decryption failed");
  if (typeof decrypted === "string") return decrypted;
  else throw new Error("Decrypted item is not a string");
}

export async function setContext(item: string): Promise<string> {
  if (item === undefined) throw new Error("setContext: item is undefined");
  const context = process.env.CONTEXT_KEY;
  if (context === undefined)
    throw new Error("setContext: CONTEXT_KEY is not set");
  const encrypted = await encrypt(item, context);
  if (encrypted === undefined) throw new Error("Encryption failed");
  return encrypted;
}
