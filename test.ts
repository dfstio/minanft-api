import type { Handler, Context, Callback } from "aws-lambda";
import { example } from "./src/mina/example";
import { checkInternet } from "./src/api/internet";

const mint: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.log("event", event);
    console.time("test");
    console.log("test started");
    //await example("contracts", "TreeFunction", 5);
    await checkInternet();
    console.log("test finished");
    console.timeEnd("test");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};

export { mint };
