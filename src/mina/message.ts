import { Telegraf, Context } from "telegraf";
import { mintInvoice, postInvoice, supportInvoice } from "../payments/stripe";

export default class BotMessage {
  bot: Telegraf<Context>;
  id: string;
  supportId: string;

  constructor(
    id: string,
    token: string = process.env.BOT_TOKEN!,
    supportId: string = process.env.SUPPORT_CHAT!,
  ) {
    this.bot = new Telegraf(token);
    this.id = id;
    this.supportId = supportId;
  }

  public async message(msg: string): Promise<void> {
    this.bot.catch((err, ctx) => {
      console.error(`Telegraf error for ${ctx.updateType}`, err);
    });

    this.bot.telegram.sendMessage(this.id, msg).catch((error) => {
      console.error(`Telegraf error`, error);
    });

    const supportMsg: string = `Message for ${this.id}: ${msg}`;
    this.bot.telegram.sendMessage(this.supportId, supportMsg).catch((error) => {
      console.error(`Telegraf error`, error);
    });
    console.log(supportMsg);
  }

  public async image(image: string, caption: string): Promise<void> {
    this.bot.catch((err, ctx) => {
      console.error(`Telegraf error for ${ctx.updateType}`, err);
    });

    this.bot.telegram.sendPhoto(this.id, image, { caption }).catch((error) => {
      console.error(`Telegraf error`, error);
    });
  }

  public async invoice(username: string, image: string): Promise<void> {
    this.bot.catch((err, ctx) => {
      console.error(`Telegraf error for ${ctx.updateType}`, err);
    });

    this.bot.telegram
      .sendInvoice(this.id, mintInvoice(this.id, username, image))
      .catch((error) => {
        console.error(`Telegraf error`, error);
      });
  }

  public async support(): Promise<void> {
    this.bot.catch((err, ctx) => {
      console.error(`Telegraf error for ${ctx.updateType}`, err);
    });

    this.bot.telegram
      .sendInvoice(this.id, supportInvoice(this.id))
      .catch((error) => {
        console.error(`Telegraf error`, error);
      });
  }
}
