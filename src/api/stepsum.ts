import Steps from "../table/steps";
import { StepsData } from "../model/stepsData";
import callLambda from "../lambda/lambda";
import { sleep } from "minanft";

export async function runStep(step: StepsData): Promise<void> {
  console.time("runStep");
  if (step.stepStatus.toString() !== "created")
    throw new Error("step is not created");
  const StepsTable = new Steps(process.env.STEPS_TABLE!);
  await StepsTable.updateStatus({
    jobId: step.jobId,
    stepId: step.stepId,
    status: "started",
  });
  let result: number = 0;
  console.time("calculated result");
  if (step.task === "merge") {
    if (step.stepData.length !== 2)
      throw new Error("Input length not 2 for merge");
    const left = Number(step.stepData[0]);
    const right = Number(step.stepData[1]);
    result = left + right;
    await sleep(500);
  } else if (step.task === "create") {
    if (step.stepData.length !== 1)
      throw new Error("Input length not 1 for create");
    await sleep(1000);
    result = Number(step.stepData[0]);
  } else throw new Error("unknown task");
  console.timeEnd("calculated result");
  await StepsTable.updateStatus({
    jobId: step.jobId,
    stepId: step.stepId,
    status: "finished",
    result: result.toString(),
  });
  await callLambda(
    "sequencer",
    JSON.stringify({ task: "run", username: step.username, jobId: step.jobId })
  );
  console.timeEnd("runStep");
}
