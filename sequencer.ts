import { Handler, Context } from "aws-lambda";
import Sequencer from "./src/api/sequencer";
import { StepsData } from "./src/model/stepsData";
import { runStep } from "./src/api/step";
import { runStepTree } from "./src/api/steptree";

const step: Handler = async (event: any, context: Context) => {
  try {
    console.log(
      "step",
      event.stepData.name,
      event.stepData.jobId,
      event.stepData.stepId
    );
    if (event.stepData !== undefined) {
      if (event.stepData.name === "sum")
        await runStep(event.stepData as StepsData);
      else if (event.stepData.name === "tree")
        await runStepTree(event.stepData as StepsData);
      else console.error("unknown stepData.name");
    } else console.error("no event.stepData");

    return {
      statusCode: 200,
      body: "ok",
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "sequencer step error",
    };
  }
};

const run: Handler = async (event: any, context: Context) => {
  try {
    console.log("run", event);
    if (event.username && event.jobId) {
      const sequencer = new Sequencer({
        jobsTable: process.env.JOBS_TABLE!,
        stepsTable: process.env.STEPS_TABLE!,
        username: event.username,
        jobId: event.jobId,
      });
      if (event.task === "start") await sequencer.startJob();
      else if (event.task === "run") await sequencer.run();
      else console.error("unknown task");
    } else console.error("no event.username or event.jobId");

    return {
      statusCode: 200,
      body: "ok",
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "sequencer run error",
    };
  }
};

export { run, step };
