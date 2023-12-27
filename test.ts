import type { Handler, Context, Callback } from "aws-lambda";
import { encrypt, decrypt } from "./src/nft/kms";
import { PrivateKey } from "o1js";

const kms: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("test");
    console.log("event", event);
    console.log("test started");
    const name = "@test_12345";
    const privateKey = PrivateKey.random().toBase58();
    console.log("privateKey", privateKey, "name", name);
    const encrypted = await encrypt(privateKey, name);
    console.log("encrypted", encrypted);
    if (encrypted === undefined) throw Error("encrypted is undefined");
    else {
      const decrypted = await decrypt(encrypted, name);
      console.log("decrypted", decrypted);
    }
    //await example("contracts", "TreeFunction", 5);
    console.log("test finished");
    console.timeEnd("test");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};

export { kms };
