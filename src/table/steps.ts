import Table from "./table";
import { StepsData } from "../model/stepsData";
import { JobStatus } from "../model/jobsData";
import { makeString } from "minanft";

export default class Steps extends Table<StepsData> {
  public async updateStatus(params: {
    jobId: string;
    stepId: string;
    status: JobStatus;
    result?: string;
    requiredStatus?: JobStatus;
  }): Promise<StepsData | undefined> {
    const { jobId, stepId, status, result, requiredStatus } = params;
    if (status === "finished" && result === undefined)
      throw new Error("result is required for finished jobs");
    const time: number = Date.now();
    return await this.updateData(
      {
        jobId,
        stepId,
      },
      status === "finished"
        ? { "#S": "status", "#T": "timeFinished", "#R": "result" }
        : status === "started"
        ? { "#S": "status", "#T": "timeStarted" }
        : status === "used"
        ? { "#S": "status", "#T": "timeUsed" }
        : { "#S": "status", "#T": "timeFailed" },
      status === "finished"
        ? {
            ":status": status,
            ":time": time,
            ":required": requiredStatus,
            ":result": result,
          }
        : { ":status": status, ":time": time, ":required": requiredStatus },
      status === "finished"
        ? "set #S = :status, #T = :time, #R = :result"
        : "set #S = :status, #T = :time",
      requiredStatus === undefined ? undefined : "#S = :required"
    );
  }
}
