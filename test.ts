import type { Handler, Context, Callback } from "aws-lambda";
import { cloud as cloudFunc, runZip } from "./src//api/cloud";

const cloud: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("test");
    console.log("event", event);
    console.log("test started");

    try {
      const result = await runZip({
        fileName: "mac.zip",
        functionName: "compile",
        args: ["arg1a", "arg2b"],
      });
      console.log("cloud test result", result);
    } catch (error: any) {
      console.error("cloud catch", (error as any).toString());
    }

    console.log("test finished");
    console.timeEnd("test");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};

export { cloud };
