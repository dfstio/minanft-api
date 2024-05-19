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
}
