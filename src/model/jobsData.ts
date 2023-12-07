export type JobStatus = "created" | "started" | "finished" | "failed" | "used";

export interface JobsData {
  id: string;
  jobId: string;

  name: string;
  task: string;
  arguments: string[];
  jobData: string[];
  timeCreated: number;
  timeStarted?: number;
  timeFinished?: number;
  timeFailed?: number;
  timeUsed?: number;
  billedDuration?: number;
  jobStatus: JobStatus;
  result?: string;
}
