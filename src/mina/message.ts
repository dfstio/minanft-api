import { Telegraf, Context } from "telegraf";
import { mintInvoice, postInvoice, supportInvoice } from "../payments/stripe";
import HistoryData from "../model/historyData";
import History from "../connector/history";
const HISTORY_TABLE = process.env.HISTORY_TABLE!;

export default class BotMessage {
  bot: Telegraf<Context>;
  id: string;
  supportId: string;
  history: History;

  constructor(
    id: string,
    token: string = process.env.BOT_TOKEN!,
    supportId: string = process.env.SUPPORT_CHAT!,
  ) {
    this.bot = new Telegraf(token);
    this.id = id;
    this.supportId = supportId;
    this.history = new History(HISTORY_TABLE, id);
    this.bot.catch((err, ctx) => {
      console.error(`Telegraf error for ${ctx.updateType}`, err);
    });
  }

  public async message(msg: string): Promise<void> {
    this.bot.telegram.sendMessage(this.id, msg).catch((error) => {
      console.error(`Telegraf error`, error);
    });
    await this.history.add(msg);

    const supportMsg: string = `Message for ${this.id}: ${msg}`;
    this.bot.telegram.sendMessage(this.supportId, supportMsg).catch((error) => {
      console.error(`Telegraf error`, error);
    });
    console.log(supportMsg);
  }

  public async support(msg: string): Promise<void> {
    this.bot.telegram.sendMessage(this.supportId, msg).catch((error) => {
      console.error(`Telegraf error`, error);
    });
    console.log("Support msg", msg);
  }

  public async image(image: string, params: any): Promise<void> {
    this.bot.telegram.sendPhoto(this.id, image, params).catch((error) => {
      console.error(`Telegraf error`, error);
    });
  }

  public async invoice(username: string, image: string): Promise<void> {
    this.bot.telegram
      .sendInvoice(this.id, mintInvoice(this.id, username, image))
      .catch((error) => {
        console.error(`Telegraf error`, error);
      });
  }

  public async supportTicket(): Promise<void> {
    this.bot.telegram
      .sendInvoice(this.id, supportInvoice(this.id))
      .catch((error) => {
        console.error(`Telegraf error`, error);
      });
  }
}
