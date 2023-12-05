import Table from "./table";
import { JobsData, JobStatus } from "../model/jobsData";
import { makeString } from "minanft";

export default class Jobs extends Table<JobsData> {
  public async createJob(params: {
    username: string;
    name: string;
    jobData: string[];
  }): Promise<string | undefined> {
    const { username, name, jobData } = params;
    const timeCreated: number = Date.now();
    const jobId: string =
      username + "." + timeCreated.toString() + "." + makeString(32);
    const item: JobsData = {
      id: username,
      jobId,
      name,
      jobData,
      timeCreated,
      status: "created" as JobStatus,
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
  }): Promise<void> {
    const { username, jobId, status, result } = params;
    if (status === "finished" && result === undefined)
      throw new Error("result is required for finished jobs");
    const time: number = Date.now();
    await this.updateData(
      {
        id: username,
        jobId,
      },
      status === "finished"
        ? { "#S": "status", "#T": "timeFinished", "#R": "result" }
        : status === "started"
        ? { "#S": "status", "#T": "timeStarted" }
        : status === "used"
        ? { "#S": "status", "#T": "timeUsed" }
        : { "#S": "status", "#T": "timeFailed" },
      status === "finished"
        ? { ":status": status, ":time": time, ":result": result }
        : { ":status": status, ":time": time },
      status === "finished"
        ? "set #S = :status, #T = :time, #R = :result"
        : "set #S = :status, #T = :time"
    );
  }
}
