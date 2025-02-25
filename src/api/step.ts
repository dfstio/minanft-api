import Steps from "../table/steps";
import Proofs from "../table/proofs";
import Jobs from "../table/jobs";
import { StepsData } from "../model/stepsData";
import { BackendPlugin, Memory } from "minanft";
import { Cache } from "o1js";
import { listFiles } from "../mina/cache";

export async function runStep(
  step: StepsData,
  plugin: BackendPlugin
): Promise<void> {
  console.time("runStep");
  console.log(`runStepTree start:`, step.task, step.stepId, step.jobId);
  Memory.info(`start`);
  if (step.stepStatus.toString() !== "created")
    throw new Error("step is not created");

  const StepsTable = new Steps(process.env.STEPS_TABLE!);

  try {
    await StepsTable.updateStatus({
      jobId: step.jobId,
      stepId: step.stepId,
      status: "started",
    });

    let result: string | undefined = undefined;
    //const cacheDir = "/mnt/efs/cache";
    //await listFiles(cacheDir);
    const cache: Cache = Cache.FileSystemDefault;

    console.log(`Compiling...`);
    console.time(`compiled`);
    await plugin.compile(cache);
    console.timeEnd(`compiled`);
    Memory.info(`compiled`);
    //await listFiles(cacheDir);

    if (step.task === "create") {
      if (step.stepData.length !== 1)
        throw new Error("Input length not 1 for create");
      console.time(`created proof`);
      result = await plugin.create(step.stepData[0]);
      console.timeEnd(`created proof`);
    } else if (step.task === "merge") {
      if (step.stepData.length !== 2)
        throw new Error("Input length not 2 for merge");

      console.time(`step: merged proofs`);
      result = await plugin.merge(step.stepData[0], step.stepData[1]);
      console.timeEnd(`step: merged proofs`);
    } else if (step.task === "verify") {
      if (step.stepData.length !== 1)
        throw new Error("Input length not 1 for verify");
      console.time(`step: verified proof`);
      result = await plugin.verify(step.stepData[0]);
      console.timeEnd(`step: verified proof`);
    } else if (step.task === "send") {
      if (step.stepData.length !== 1)
        throw new Error("Input length not 1 for send");
      console.time(`step: sent`);
      result = await plugin.send(step.stepData[0]);
      console.timeEnd(`step: sent`);
    } else if (step.task === "mint") {
      if (step.stepData.length !== 1)
        throw new Error("Input length not 1 for mint");
      console.time(`step: minted`);
      result = await plugin.mint(step.stepData[0]);
      console.timeEnd(`step: minted`);
    } else throw new Error("unknown task");
    Memory.info(`calculated or verified or minted`);
    if (result === undefined) throw new Error("result is undefined");

    await StepsTable.updateStatus({
      jobId: step.jobId,
      stepId: step.stepId,
      status: "finished",
      result: result,
    });

    const ProofsTable = new Proofs(process.env.PROOFS_TABLE!);
    await ProofsTable.create({
      jobId: step.jobId,
      stepId: step.stepId,
    });
  } catch (error) {
    console.error("runStep error:", (<any>error).toString());
    await StepsTable.updateStatus({
      jobId: step.jobId,
      stepId: step.stepId,
      status: "failed",
    });

    const JobsTable = new Jobs(process.env.JOBS_TABLE!);
    await JobsTable.updateStatus({
      username: step.username,
      jobId: step.jobId,
      status: "failed",
      billedDuration: step.billedDuration ?? 0,
    });
    Memory.info(`failed`);
  }
  Memory.info(`finished`);
  console.timeEnd("runStep");
}
