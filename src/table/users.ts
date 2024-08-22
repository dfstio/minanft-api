import Table from "./table";
import UserData from "../model/userData";
import AccountData from "../model/accountData";
import AIUsage from "../model/aiusage";
import { MAX_IMAGES, MAX_TOKENS } from "../model/userData";

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
    const lastSeen: number = Date.now();
    const lastSeenDate: string = new Date(lastSeen).toISOString();
    await this.updateData(
      { id: id },
      {
        "#P": "prompt_tokens",
        "#C": "completion_tokens",
        "#T": "total_tokens",
        "#L": "lastSeen",
        "#LD": "lastSeenDate",
      },
      {
        ":p": usage.prompt_tokens,
        ":c": usage.completion_tokens,
        ":t": usage.total_tokens,
        ":l": lastSeen,
        ":ld": lastSeenDate,
      },
      `ADD #P :p, #C :c, #T :t SET #L = :l, #LD = :ld`
    );
  }

  public async updateImageUsage(id: string): Promise<void> {
    const lastSeen: number = Date.now();
    const lastSeenDate: string = new Date(lastSeen).toISOString();
    await this.updateData(
      { id: id },
      {
        "#I": "images_created",
        "#L": "lastSeen",
        "#LD": "lastSeenDate",
      },
      { ":i": 1, ":l": lastSeen, ":ld": lastSeenDate },
      `ADD #I :i SET #L = :l, #LD = :ld`
    );
  }
  public async updateAllowedUsage(id: string): Promise<void> {
    const lastSeen: number = Date.now();
    const lastSeenDate: string = new Date(lastSeen).toISOString();
    await this.updateData(
      { id: id },
      {
        "#I": "allowed_images",
        "#T": "allowed_tokens",
      },
      { ":i": MAX_IMAGES, ":t": MAX_TOKENS },
      `ADD #I :i, #T :t`
    );
  }
}
