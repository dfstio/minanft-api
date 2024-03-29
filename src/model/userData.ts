import AccountData from "./accountData";

export default interface UserData {
  id: string;
  username?: string;
  minanft: string[];
  message_id: string;
  message: string;
  currentAnswer: number;
  language_code: string;
  voice?: boolean;
  chatGPTinit: boolean;
  user?: any;
  name?: string;
  email?: string;
  phone?: string;
  education?: string;
  why?: string;
  fileUrl?: string;
  account?: AccountData;
}
