import { Telegraf, Markup } from "telegraf";
import BotMessage from "../chatgpt/message";
import { getToken, getTokenByIndex, getSaleTokenByIndex } from "../nft/algolia";
import { buyInvoice } from "../payments/stripe";
import { initLanguages, getLanguage, getT } from "../lang/lang";

/*
new - Create new NFT
list - List all NFTs
secret - Get secret key of your NFT 		
support - Buy support ticket 
sell - Sell NFT
buy - Buy NFT 		


new - Create new NFT
auth - Get authorisation JWT token
voiceon - Enable voice messages
voiceoff - Disable voice messages	


async function supportTicket(id: string, language: string): Promise<void> {
  const bot = new BotMessage(id, language);
  await bot.supportTicket();
}

async function botCommandList(
  chatId: string,
  language: string,
  name: string | undefined = undefined
): Promise<void> {
  try {
    const bot = new BotMessage(chatId, language);
    // await bot.supportTicket();

    const id: number = 0;
    let token: any = undefined;
    if (name)
      token = await getToken(name.substr(0, 1) == "@" ? name : "@" + name);
    if (!token) token = await getTokenByIndex(id);
    if (token && token.image && token.name) {
      const prev = id === 0 ? 0 : id - 1;
      const next = id + 1;
      await bot.image(
        `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`,
        {
          caption: token.onSale
            ? `MinaNFT ${token.name.replaceAll(
                "@",
                ""
              )}\nPrice: ${token.currency.toUpperCase()} ${token.price}`
            : `MinaNFT ${token.name.replaceAll("@", "")}`,
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(
            token.onSale
              ? [
                  Markup.button.callback(
                    "Buy",
                    JSON.stringify({ a: "by", id: id })
                  ),
                  Markup.button.callback(
                    "<️",
                    JSON.stringify({ a: "list", id: prev }),
                    id === 0 ? true : false
                  ),
                  Markup.button.callback(
                    ">️",
                    JSON.stringify({ a: "list", id: next })
                  ),
                ]
              : [
                  Markup.button.callback(
                    "<️",
                    JSON.stringify({ a: "list", id: prev }),
                    id === 0 ? true : false
                  ),
                  Markup.button.callback(
                    ">️",
                    JSON.stringify({ a: "list", id: next })
                  ),
                ]
          ),
        }
      );
    } else await bot.tmessage("ErrorloadingNFT"); // "ErrorloadingNFT": "Error loading NFT"
  } catch (err) {
    console.error("botCommandList - catch", err);
  }
}

async function botCommandBuy(
  chatId: string,
  language: string,
  name: string | undefined = undefined
): Promise<void> {
  try {
    const bot = new BotMessage(chatId, language);
    // await bot.supportTicket();

    const id: number = 0;
    let token: any = undefined;
    if (name)
      token = await getToken(
        name.substr(0, 1) == "@" ? name.substr(1, 31) : name.substr(0, 30)
      );
    if (!token) token = await getSaleTokenByIndex(id);
    if (token && token.image && token.name) {
      const prev = id === 0 ? 0 : id - 1;
      const next = id + 1;
      await bot.image(
        `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`,
        {
          caption: `MinaNFT ${token.name.replaceAll(
            "@",
            ""
          )}\nPrice: ${token.currency.toUpperCase()} ${token.price}`,
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            Markup.button.callback("Buy", JSON.stringify({ a: "buy", id: id })),
            Markup.button.callback(
              "<️",
              JSON.stringify({ a: "load", id: prev }),
              id === 0 ? true : false
            ),
            Markup.button.callback(
              ">️",
              JSON.stringify({ a: "load", id: next })
            ),
          ]),
        }
      );
    } else await bot.tmessage("ErrorloadingNFT"); // "ErrorloadingNFT": "Error loading NFT"
  } catch (err) {
    console.error("botCommandBuy - catch", err);
  }
}

async function botCommandCallback(ctx: any): Promise<void> {
  try {
    console.log(
      "botCommandCallback",
      ctx,
      ctx.update.callback_query,
      ctx.update.callback_query.from
    );
    if (
      ctx &&
      ctx.update &&
      ctx.update.callback_query &&
      ctx.update.callback_query.from &&
      ctx.update.callback_query.from.id &&
      ctx.update.callback_query.data
    ) {
      console.log(
        "botCommandCallback data",
        ctx.update.callback_query.data,
        ctx.update.callback_query,
        ctx.update.callback_query.from
      );
      const data = JSON.parse(ctx.update.callback_query.data);
      console.log("callback_query data", data);
      await initLanguages();
      const language = await getLanguage(ctx.update.callback_query.from.id);
      const T = getT(language);

      let id = parseInt(data.id);
      const action = data.a;
      let tokenId = 0;
      const isList: boolean = action == "by" || action == "list";
      let token: any = isList
        ? await getTokenByIndex(id)
        : await getSaleTokenByIndex(id);
      console.log("show token", id, token);
      if (!token) {
        id = 0;
        token = await getTokenByIndex(id);
      }
      await ctx.answerCbQuery(
        `Loading NFT ${token && token.name ? token.name : ""}`
      );

      if (token) {
        if (action === "load" || action === "list") {
          //ctx.telegram.sendMessage(ctx.message.chat.id, `${token.tokenId}: ${token.name} Price: ${token.currency.toUpperCase()} ${token.price}\n`)
          const prev = id === 0 ? 0 : id - 1;
          const next = id + 1;

          const replyOptions = Markup.inlineKeyboard(
            token.onSale
              ? [
                  Markup.button.callback(
                    "Buy",
                    JSON.stringify({
                      a: isList ? "by" : "buy",
                      id: id,
                    })
                  ),
                  Markup.button.callback(
                    "<️",
                    JSON.stringify({
                      a: isList ? "list" : "load",
                      id: prev,
                    }),
                    id === 0 ? true : false
                  ),
                  Markup.button.callback(
                    ">️",
                    JSON.stringify({
                      a: isList ? "list" : "load",
                      id: next,
                    })
                  ),
                ]
              : [
                  Markup.button.callback(
                    "<️",
                    JSON.stringify({
                      a: isList ? "list" : "load",
                      id: prev,
                    }),
                    id === 0 ? true : false
                  ),
                  Markup.button.callback(
                    ">️",
                    JSON.stringify({
                      a: isList ? "list" : "load",
                      id: next,
                    })
                  ),
                ]
          );

          await ctx.editMessageMedia(
            {
              type: "photo",
              media: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`,
              caption: token.onSale
                ? `MinaNFT ${token.name.replaceAll(
                    "@",
                    ""
                  )}\nPrice: ${token.currency.toUpperCase()} ${token.price}`
                : `MinaNFT ${token.name.replaceAll("@", "")}`,
              parse_mode: "Markdown",
            },
            replyOptions
          );
        } else if (action === "buy" || action === "by") {
          const stripeMsg = await ctx.replyWithInvoice(buyInvoice(token, T));
        }
      }
    }
  } catch (err) {
    console.error("botCommandCallback - catch", err);
  }
}

export { supportTicket, botCommandList, botCommandBuy, botCommandCallback };
*/
