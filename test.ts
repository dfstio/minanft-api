import type { Handler, Context, Callback } from "aws-lambda";
import os from "os";
import fs from "fs/promises";
import { listFiles } from "./src/mina/cache";

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
    const cacheDir = "/mnt/efs/cache";
    await listFiles(cacheDir);
    //await fs.rm(cacheDir, { recursive: true });
    //await listFiles(cacheDir);

    console.log("test finished");
    console.timeEnd("test");
    return 200;
  } catch (error) {
    console.error("catch", (error as any).toString());
    return 200;
  }
};

export { cloud };
