import Jobs from "../table/jobs";
import Steps from "../table/steps";
import { JobStatus, JobsData } from "../model/jobsData";
import { StepsData, StepTask } from "../model/stepsData";
import callLambda from "../lambda/lambda";
import { makeString, sleep } from "minanft";

export default class Sequencer {
  jobsTable: string;
  stepsTable: string;
  username: string;
  jobId?: string;

  constructor(
    jobsTable: string,
    stepsTable: string,
    username: string,
    jobId?: string
  ) {
    this.jobsTable = jobsTable;
    this.stepsTable = stepsTable;
    this.username = username;
    this.jobId = jobId;
  }

  public async createJob(params: {
    username: string;
    name: string;
    jobData: string[];
  }): Promise<string | undefined> {
    if (this.username !== params.username) throw new Error("username mismatch");
    const JobsTable = new Jobs(this.jobsTable);
    return await JobsTable.createJob(params);
  }

  public async updateJobStatus(params: {
    username: string;
    jobId: string;
    status: JobStatus;
    result?: string;
  }): Promise<void> {
    const JobsTable = new Jobs(this.jobsTable);
    await JobsTable.updateStatus(params);
  }

  public async startJob() {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const JobsTable = new Jobs(this.jobsTable);
    const StepsTable = new Steps(this.stepsTable);
    const job: JobsData | undefined = await JobsTable.get({
      id: this.username,
      jobId: this.jobId,
    });
    if (job === undefined) throw new Error("job not found");
    for (let i = 0; i < job.jobData.length; i++) {
      const stepId: string = i.toString();
      const stepData: StepsData = {
        jobId: this.jobId,
        stepId,
        username: this.username,
        name: job.name,
        task: "create" as StepTask,
        origins: [i.toString()],
        stepData: [job.jobData[i]],
        timeCreated: Date.now(),
        status: "created" as JobStatus,
      };
      try {
        await StepsTable.create(stepData);
        await callLambda("step", JSON.stringify({ stepData }));
      } catch (error: any) {
        console.error("Error: Sequencer: startJob", error);
        throw new Error("Error: Sequencer: startJob");
      }
    }
  }

  public async run(): Promise<string | undefined> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const StepsTable = new Steps(this.stepsTable);
    let results: StepsData[] = await StepsTable.queryData("jobId = :id", {
      ":id": this.jobId,
    });

    if (
      results.length === 0 ||
      results.filter((step) => step.status === "finished").length === 0
    ) {
      await sleep(1000 + Math.random() * 10000);
      results = await StepsTable.queryData("jobId = :id", {
        ":id": this.jobId,
      });
    }

    if (
      results.length === 0 ||
      results.filter((step) => step.status === "finished").length === 0
    )
      return undefined;

    if (results.filter((step) => step.status === "finished").length === 1) {
      if (
        results.filter(
          (step) => step.status === "created" || step.status === "started"
        ).length > 0
      )
        return undefined;
      // We have final result, let's check if it's the only one one more time after delay
      await sleep(5000);
      results = await StepsTable.queryData("jobId = :id", {
        ":id": this.jobId,
      });
      if (results.filter((step) => step.status === "finished").length === 1) {
        if (
          results.filter(
            (step) => step.status === "created" || step.status === "started"
          ).length > 0
        )
          return undefined;
        const result: StepsData = results.filter(
          (step) => step.status === "finished"
        )[0];
        if (result.result === undefined) throw new Error("result is undefined");
        const JobsTable = new Jobs(this.jobsTable);
        await JobsTable.updateStatus({
          username: this.username,
          jobId: this.jobId,
          status: "finished",
          result: result.result,
        });
        return result.result;
      }
    }

    // We have more than one result, we need to merge
    const stepResults: StepsData[] = [];
    const sourceSteps: StepsData[] = results.filter(
      (step) => step.status === "finished"
    );
    for (let i = 0; i < sourceSteps.length; i++) {
      const step: StepsData = sourceSteps[i];
      if (step.result === undefined) throw new Error("result is undefined");
      const updatedStep = await StepsTable.updateStatus({
        jobId: this.jobId,
        stepId: step.stepId,
        status: "used",
        requiredStatus: "finished",
      });
      if (updatedStep === undefined)
        console.log("Sequencer: run: updateStatus operation failed");
      else if (updatedStep.status !== "used")
        console.log(
          "Sequencer: run: updateStatus update failed, current status:",
          updatedStep.stepId,
          updatedStep.status
        );
      else stepResults.push(step);
    }

    if (stepResults.length === 0) return undefined;
    if (stepResults.length % 2 === 1) {
      // We have odd number of results, we need to return the last one back to the queue
      await StepsTable.updateStatus({
        jobId: this.jobId,
        stepId: stepResults[stepResults.length - 1].stepId,
        status: "finished",
      });
    }
    const mergeStepsNumber = Math.floor(stepResults.length / 2);
    for (let i = 0; i < mergeStepsNumber; i++) {
      const stepId: string = Date.now().toString() + "." + makeString(32);
      const name = stepResults[2 * i].name;
      if (name !== stepResults[2 * i + 1].name)
        throw new Error("name mismatch");
      if (
        stepResults[2 * i].result === undefined ||
        stepResults[2 * i + 1].result === undefined
      )
        throw new Error(`result is undefined`);
      else {
        const stepData: StepsData = {
          jobId: this.jobId,
          stepId,
          username: this.username,
          name,
          task: "merge" as StepTask,
          origins: [
            ...stepResults[2 * i].origins,
            ...stepResults[2 * i + 1].origins,
          ],
          stepData: [
            stepResults[2 * i].result!,
            stepResults[2 * i + 1].result!,
          ],
          timeCreated: Date.now(),
          status: "created" as JobStatus,
        };
        try {
          await StepsTable.create(stepData);
          await callLambda("step", JSON.stringify({ stepData }));
        } catch (error: any) {
          console.error("Error: Sequencer: createStep", error);
        }
      }
    }
    return undefined;
  }

  public async getJobStatus(): Promise<JobsData> {
    if (this.jobId === undefined) throw new Error("jobId is undefined");
    const JobsTable = new Jobs(this.jobsTable);
    const job: JobsData | undefined = await JobsTable.get({
      id: this.username,
      jobId: this.jobId,
    });
    if (job === undefined) throw new Error("job not found");
    if (job.status === "finished")
      await JobsTable.updateStatus({
        username: this.username,
        jobId: this.jobId,
        status: "used",
      });
    return job;
  }
}
