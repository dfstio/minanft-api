import { Telegraf, Context, Input } from "telegraf";
import { mintInvoice, postInvoice, supportInvoice } from "../payments/stripe";
import { getT, getVoice } from "../lang/lang";
import History from "../table/history";
import { InputFile } from "telegraf/typings/core/types/typegram";
import { textToVoice } from "../voice/polly";
import { sleep } from "minanft";
import callLambda from "../lambda/lambda";
const HISTORY_TABLE = process.env.HISTORY_TABLE!;

export default class BotMessage {
  bot: Telegraf<Context>;
  id: string;
  supportId: string;
  history: History;
  language: string;
  T: any;

  constructor(
    id: string,
    language: string,
    token: string = process.env.BOT_TOKEN!,
    supportId: string = process.env.SUPPORT_CHAT!
  ) {
    this.bot = new Telegraf(token);
    this.id = id;
    this.supportId = supportId;
    this.history = new History(HISTORY_TABLE, id);
    this.language = language ?? "en";
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
    await this.history.add(msgTransalted, false);

    const supportMsg: string = `Message for ${this.id}: ${msgTransalted}`;
    this.bot.telegram.sendMessage(this.supportId, supportMsg).catch((error) => {
      console.error(`Telegraf error`, error);
    });
    console.log(supportMsg);
  }

  public async message(
    msg: string,
    addToHistory: boolean = true
  ): Promise<void> {
    this.bot.telegram.sendMessage(this.id, msg).catch((error) => {
      console.error(`Telegraf error`, error);
    });
    if (addToHistory) await this.history.add(msg);

    const supportMsg: string = `Message for ${this.id}: ${msg}`;
    this.bot.telegram.sendMessage(this.supportId, supportMsg).catch((error) => {
      console.error(`Telegraf error`, error);
    });
    console.log(supportMsg);
    if (await getVoice(this.id)) {
      console.log("Sending voice", this.id, msg);
      const voice = await textToVoice(msg, this.id, this.language);
      console.log("Voice", voice);
      if (voice === undefined) {
        console.error("Voice is undefined");
        return;
      }
      await this.audio(voice, {});
    }
  }

  /*
   * system message
   */
  public async smessage(msg: string, params: any = {}): Promise<void> {
    const msgTransalted: string = this.T(msg, params);
    await this.history.add(msgTransalted, false);
    await callLambda(
      "ask",
      JSON.stringify({
        id: this.id,
        message: "system message",
        image: "",
        auth: process.env.CHATGPTPLUGINAUTH!,
      })
    );

    const supportMsg: string = `System message for ${this.id}: ${msgTransalted}`;
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

  public async audio(mp3: string, params: any): Promise<void> {
    this.bot.telegram.sendAudio(this.id, mp3, params).catch((error) => {
      console.error(`Telegraf error`, error);
    });
  }

  public async file(
    data: Buffer,
    filename: string | undefined,
    params: any = {}
  ): Promise<void> {
    const file: InputFile = Input.fromBuffer(data, filename);
    this.bot.telegram.sendDocument(this.id, file, params).catch((error) => {
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
