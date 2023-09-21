import { Telegraf, Context } from "telegraf";
import { mintInvoice, postInvoice, supportInvoice } from "../payments/stripe";
import HistoryData from "../model/historyData";
import { getT } from '../lang/lang'
import History from "../table/history";
const HISTORY_TABLE = process.env.HISTORY_TABLE!;

export default class BotMessage {
  bot: Telegraf<Context>;
  id: string;
  supportId: string;
  history: History;
  T: any;

  constructor(
    id: string,
    language: string,
    token: string = process.env.BOT_TOKEN!,
    supportId: string = process.env.SUPPORT_CHAT!,
  ) {
    this.bot = new Telegraf(token);
    this.id = id;
    this.supportId = supportId;
    this.history = new History(HISTORY_TABLE, id);
    this.T = getT(language);
    this.bot.catch((err, ctx) => {
      console.error(`Telegraf error for ${ctx.updateType}`, err);
    });
  }

  public async tmessage(msg: string, params: any = {}): Promise<void> {
    const msgTransalted: string = this.T(msg, params);
    this.bot.telegram.sendMessage(this.id, msgTransalted).catch((error) => {
      console.error(`Telegraf error`, error);
    });
    await this.history.add(msgTransalted);

    const supportMsg: string = `Message for ${this.id}: ${msgTransalted}`;
    this.bot.telegram.sendMessage(this.supportId, supportMsg).catch((error) => {
      console.error(`Telegraf error`, error);
    });
    console.log(supportMsg);
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
      .sendInvoice(this.id, mintInvoice(this.id, this.T, username, image))
      .catch((error) => {
        console.error(`Telegraf error`, error);
      });
  }

  public async supportTicket(): Promise<void> {
    this.bot.telegram
      .sendInvoice(this.id, supportInvoice(this.id, this.T))
      .catch((error) => {
        console.error(`Telegraf error`, error);
      });
  }
}
