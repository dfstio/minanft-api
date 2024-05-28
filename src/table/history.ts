import Table from "./table";
import type HistoryData from "../model/historyData";
const HISTORY_HOURS: number = Number(process.env.HISTORY_HOURS!);
const HISTORY_CHARS: number = Number(process.env.HISTORY_CHARS!);
const HISTORY_TABLE = process.env.HISTORY_TABLE!;

export default class History extends Table<HistoryData> {
  private readonly id: string;

  constructor(tableName: string, id: string) {
    super(tableName);
    this.id = id;
  }

  public async add(msg: string, isUser: boolean = false): Promise<void> {
    const message = {
      role: isUser ? "user" : "system",
      content: msg,
    };
    await this.addAnswer(message);
  }

  public async addImage(msg: string, imageUrl: string): Promise<void> {
    const message = {
      role: "user",
      content: [
        { type: "text", text: msg },
        {
          type: "image_url",
          image_url: { url: imageUrl },
        },
      ],
    };
    await this.addAnswer(message);
  }

  public async addAnswer(message: any): Promise<void> {
    await this.create({
      id: this.id,
      time: Date.now(),
      message,
    });
  }

  public async query(): Promise<HistoryData[]> {
    return await this.queryData("id = :id", { ":id": this.id });
  }

  public async remove(time: number): Promise<void> {
    await super.remove({ id: this.id, time: time });
  }

  public static async clean(
    cutoffTime: number | undefined = undefined
  ): Promise<void> {
    try {
      const history = new Table(HISTORY_TABLE);
      let data = await history.scan();
      let iteration = 0;
      let cleaned = 0;
      const cutoff =
        cutoffTime ?? Date.now() - HISTORY_HOURS * 60 * 60 * 1000 * 2;
      while (data && data.length > 0 && iteration < 10) {
        for (const item of data) {
          const id = (item as any).id;
          const time = (item as any).time;
          if (id === undefined || time === undefined) {
            console.error("History.clean: invalid item", item);
          } else if (time < cutoff) {
            await history.remove({
              id,
              time,
            });
            cleaned++;
          }
        }
        data = await history.scan();
        iteration++;
      }
      console.log("History.clean: cleaned", cleaned, "items");
    } catch (error: any) {
      console.error("History.clean error", error);
    }
  }

  public async build(context: any[]): Promise<any[]> {
    const history: HistoryData[] = await this.query();
    const messages: any[] = [];
    let size: number = 0;
    for (const msg of context) {
      const msgSize: number = (msg.content || "").length;
      size += msgSize;
      messages.push(msg);
    }

    history.sort((a, b) => b.time - a.time);
    //console.log('history: ', history)

    const timeLimit: number = Date.now() - HISTORY_HOURS * 60 * 60 * 1000;
    const subset: HistoryData[] = [];
    let stop = false;
    for (const item of history) {
      const msgSize: number = (item.message.content || "").length;
      if (
        item.time > timeLimit &&
        size + msgSize < HISTORY_CHARS &&
        stop === false
      ) {
        size += msgSize;
        subset.push(item);
      } else {
        stop = true;
        await this.remove(item.time);
      }
    }

    subset.sort((a, b) => a.time - b.time);
    for (const item of subset) {
      messages.push(item.message);
    }
    return messages;
  }
}
