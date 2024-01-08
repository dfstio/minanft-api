export interface AiData {
  answer: string;
  needsPostProcessing: boolean;
  data?: any;
  message?: string;
  messageParams?: any;
  support?: string;
  functionName?: string;
}
