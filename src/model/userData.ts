import AccountData from "./accountData";

export default interface UserData {
  id: string;
  username?: string;
  message_id: string;
  message: string;
  language_code: string;
  voice?: boolean;
  user?: any;
  name?: string;
  images_created?: number;
  allowed_images?: number;
  firstSeen?: number;
  lastSeen?: number;
  firstSeenDate?: string;
  lastSeenDate?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  allowed_tokens?: number;
}
