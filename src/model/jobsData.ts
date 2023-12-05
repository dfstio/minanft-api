export type JobStatus = "created" | "started" | "finished" | "failed" | "used";

export interface JobsData {
  id: string;
  jobId: string;

  name: string;
  jobData: string[];
  timeCreated: number;
  timeStarted?: number;
  timeFinished?: number;
  timeFailed?: number;
  timeUsed?: number;
  status: JobStatus;
  result?: string;
}
