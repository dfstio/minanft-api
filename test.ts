import type { Handler, Context, Callback } from "aws-lambda";
import os from "os";

const cloud: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("test");
    console.log("event", event);
    console.log("test started");
    const cpuCores = os.cpus();
    console.log(cpuCores);
    for (const core of cpuCores) {
      console.log(core.times);
    }
    const numberOfCPUCores = cpuCores.length;
    console.log("CPU cores:", numberOfCPUCores);

    console.log("test finished");
    console.timeEnd("test");
    return {
      statusCode: 200,
    };
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};

export { cloud };
