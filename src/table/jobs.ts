import Table from "./table";
import { JobsData, JobStatus } from "../model/jobsData";
import { generateId } from "../api/hash";

export default class Jobs extends Table<JobsData> {
  public async createJob(params: {
    username: string;
    developer: string;
    jobName: string;
    task: string;
    args: string[];
    jobData: string[];
    isStarted?: boolean;
    timeStarted?: number;
    txNumber: number;
  }): Promise<string | undefined> {
    const {
      username,
      developer,
      jobName,
      jobData,
      task,
      args,
      isStarted,
      timeStarted,
    } = params;
    const timeCreated: number = timeStarted ?? Date.now();
    const jobId: string = generateId({
      username,
      timeCreated,
    });

    const item: JobsData = {
      id: username,
      jobId,
      developer,
      jobName,
      task,
      args,
      jobData,
      txNumber: params.txNumber,
      timeCreated,
      jobStatus: "created" as JobStatus,
    };
    if (isStarted === true) item.timeStarted = timeCreated;
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
      "id, billedDuration, timeCreated, timeFinished, jobStatus, jobName, task"
    );
  }
}
