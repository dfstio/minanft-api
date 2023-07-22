import { ChatCompletionRequestMessage } from "openai";

export default interface HistoryData {
    id: string;
    time: number;
    message: ChatCompletionRequestMessage;
}
