import Table from "./table";
import { JobsData, JobStatus } from "../model/jobsData";
import { makeString } from "minanft";

export default class Jobs extends Table<JobsData> {
  public async createJob(params: {
    username: string;
    developer: string;
    name: string;
    task: string;
    args: string[];
    jobData: string[];
  }): Promise<string | undefined> {
    const { username, developer, name, jobData, task, args } = params;
    const timeCreated: number = Date.now();
    const jobId: string =
      username + "." + timeCreated.toString() + "." + makeString(32);
    const item: JobsData = {
      id: username,
      jobId,
      developer,
      name,
      task,
      args,
      jobData,
      timeCreated,
      jobStatus: "created" as JobStatus,
    };
    try {
      await this.create(item);
      return jobId;
    } catch (error: any) {
      console.error("Error: Jobs: createJob", error);
      return undefined;
    }
  }

  public async updateStatus(params: {
    username: string;
    jobId: string;
    status: JobStatus;
    result?: string;
    billedDuration?: number;
  }): Promise<void> {
    const { username, jobId, status, result, billedDuration } = params;
    if (
      status === "finished" &&
      (result === undefined || billedDuration === undefined)
    )
      throw new Error(
        "result and billingDuration is required for finished jobs"
      );
    const time: number = Date.now();
    await this.updateData(
      {
        id: username,
        jobId,
      },
      status === "finished"
        ? {
            "#S": "jobStatus",
            "#T": "timeFinished",
            "#R": "result",
            "#B": "billedDuration",
          }
        : status === "started"
        ? { "#S": "jobStatus", "#T": "timeStarted" }
        : status === "used"
        ? { "#S": "jobStatus", "#T": "timeUsed" }
        : { "#S": "jobStatus", "#T": "timeFailed" },
      status === "finished"
        ? {
            ":status": status,
            ":time": time,
            ":result": result,
            ":billedDuration": billedDuration,
          }
        : { ":status": status, ":time": time },
      status === "finished"
        ? "set #S = :status, #T = :time, #R = :result, #B = :billedDuration"
        : "set #S = :status, #T = :time"
    );
  }

  public async queryBilling(id: string): Promise<JobsData[]> {
    return await this.queryData(
      "id = :id",
      { ":id": id },
      "id, jobId, billedDuration, timeCreated, timeFinished, jobStatus, developer, name, task"
    );
  }
}
