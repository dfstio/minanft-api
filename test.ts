import type { Handler, Context, Callback } from "aws-lambda";
import { example } from "./src/mina/example";

const mint: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.log("event", event);
    console.log("Mint started");
    await example();
    console.log("Mint finished");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};

export { mint };
