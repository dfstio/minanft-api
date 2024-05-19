import Table from "./table";
import UserData from "../model/userData";
import AccountData from "../model/accountData";
import AIUsage from "../model/aiusage";

export default class Users extends Table<UserData> {
  constructor(tableName: string) {
    super(tableName);
  }

  public async getItem(id: string): Promise<UserData | undefined> {
    return await this.get({ id: id });
  }

  public async getCurrentLanguage(id: string): Promise<string> {
    const data: UserData | undefined = await this.get({ id: id });
    if (data === undefined) return "en";
    return data.language_code;
  }

  public async getVoice(id: string): Promise<boolean> {
    const data: UserData | undefined = await this.get({ id: id });
    if (data === undefined) return false;
    return data.voice === true ? true : false;
  }

  public async setVoice(id: string, voice: boolean): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#V": "voice",
      },
      { ":voice": voice },
      `set #V = :voice`
    );
  }

  private getExpAttrValue(
    shortName: string,
    answer: string,
    num: number
  ): object {
    return JSON.parse(`{":ans" : ${num},"${shortName}" : "${answer}"}`);
  }

  public async updateAccount(id: string, account: AccountData): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#A": "account",
      },
      { ":acc": account },
      `set #A = :acc`
    );
  }

  public async updateUsage(id: string, usage: AIUsage): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#P": "prompt_tokens",
        "#C": "completion_tokens",
        "#T": "total_tokens",
      },
      {
        ":p": usage.prompt_tokens,
        ":c": usage.completion_tokens,
        ":t": usage.total_tokens,
      },
      `ADD #P :p, #C :c, #T :t`
    );
  }

  public async updateImageUsage(id: string): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#I": "images_created",
      },
      { ":i": 1 },
      `ADD #I :i`
    );
  }
}
