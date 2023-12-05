import { JobStatus } from "./jobsData";

export type StepTask = "create" | "merge";

export interface StepsData {
  jobId: string;
  stepId: string;

  username: string;
  name: string;
  task: StepTask;
  origins: string[];
  stepData: string[];
  timeCreated: number;
  timeStarted?: number;
  timeFinished?: number;
  timeFailed?: number;
  status: JobStatus;
  result?: string;
}
