import type { Handler, Context, Callback } from "aws-lambda";
import { encrypt, decrypt, encryptJSON, decryptJSON } from "./src/nft/kms";
import { PrivateKey } from "o1js";
import { explorerTransaction } from "./src/mina/init";
import { Berkeley } from "minanft";

const kms: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("test");
    console.log("event", event);
    console.log("test started");
    console.log("explorerTransaction", explorerTransaction());
    console.log("Berkeley", Berkeley);
    console.log("Berkeley url", Berkeley.explorerTransactionUrl);

    /*
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

    const json = { name, privateKey, a: "ghdfjsgfs", event };
    console.log("json", json);
    const encryptedJSON = await encryptJSON(json, name);
    console.log("encryptedJSON", encryptedJSON);
    if (encryptedJSON === undefined) throw Error("encryptedJSON is undefined");
    else {
      const decryptedJSON = await decryptJSON(encryptedJSON, name);
      console.log("decryptedJSON", decryptedJSON);
    }

    */
    console.log("test finished");
    console.timeEnd("test");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};

export { kms };
