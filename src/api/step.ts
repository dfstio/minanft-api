import Steps from "../table/steps";
import { StepsData } from "../model/stepsData";
import callLambda from "../lambda/lambda";
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
  await StepsTable.updateStatus({
    jobId: step.jobId,
    stepId: step.stepId,
    status: "started",
  });

  let result: string | undefined = undefined;
  const cacheDir = "/mnt/efs/cache";
  await listFiles(cacheDir);
  const cache: Cache = Cache.FileSystem(cacheDir);

  console.log(`Compiling...`);
  console.time(`compiled`);
  await plugin.compile(cache);
  console.timeEnd(`compiled`);
  Memory.info(`compiled`);
  await listFiles(cacheDir);

  if (step.task === "create") {
    if (step.stepData.length !== 1)
      throw new Error("Input length not 1 for create");
    console.time(`created proof`);
    result = await plugin.create(step.stepData[0]);
    console.timeEnd(`created proof`);
  } else if (step.task === "merge") {
    if (step.stepData.length !== 2)
      throw new Error("Input length not 2 for merge");

    console.time(`merged proofs`);
    result = await plugin.merge(step.stepData[0], step.stepData[1]);
    console.timeEnd(`merged proofs`);
  } else throw new Error("unknown task");
  Memory.info(`calculated proof`);
  if (result === undefined) throw new Error("result is undefined");

  await StepsTable.updateStatus({
    jobId: step.jobId,
    stepId: step.stepId,
    status: "finished",
    result: result,
  });

  await callLambda(
    "sequencer",
    JSON.stringify({ task: "run", username: step.username, jobId: step.jobId })
  );
  console.timeEnd("runStep");
}
