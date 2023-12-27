import BotMessage from "../mina/message";
import Names from "../table/names";
import type NamesData from "../model/namesData";
import { algoliaWriteToken } from "../nft/algolia";
import { botCommandList } from "../payments/botcommands";

const NAMES_TABLE = process.env.TESTWORLD2_NAMES_TABLE!;

const currencies: string[] = ["USD", "EUR", "GBP", "CAD", "JPY"];
const functions: any[] = [
  {
    name: "view",
    description: "Shows to the user all NFTs or NFT with specific name",
    parameters: {
      type: "object",
      properties: {
        nft_name: {
          type: "string",
          description: "Mina NFT avatar name to view",
        },
      },
    },
  },
  {
    name: "sell",
    description: "Sell user's NFT for money",
    parameters: {
      type: "object",
      properties: {
        price: {
          type: "integer",
          description: "The sale price of NFT",
        },
        currency: {
          type: "string",
          description: "The currency of sale",
          enum: currencies,
        },
      },
      required: ["price", "currency"],
    },
  },
];

async function handleFunctionCall(
  id: string,
  message: any,
  username: string | undefined,
  language: string
): Promise<void> {
  console.log("handleFunctionCall", id, message, username, language);
  if (message && message.arguments) {
    try {
      const request = JSON.parse(message.arguments);
      const bot = new BotMessage(id, language);
      console.log("Arguments", request);

      if (message.name == "view") {
        console.log("Function view:", request);
        if (request.nft_name)
          await bot.tmessage("letmeshowyou", {
            nftname: "NFT" + request.nft_name,
          });
        else await bot.tmessage("letmeshowyouall");
        await botCommandList(id, language, request.nft_name);
        return;
      }

      if (message.name == "sell") {
        console.log("Function sell:", request);
        if (request.price && request.currency) {
          if (
            currencies.includes(request.currency) &&
            username &&
            username !== "" &&
            Number(request.price)
          ) {
            const names = new Names(NAMES_TABLE);
            //  "sellingnftforcurrencyprice": "Selling NFT {{name}} for {{currency}} {{price}}"
            await bot.tmessage("sellingnftforcurrencyprice", {
              name: username ? username.replaceAll("@", "") : "",
              currency: request.currency,
              price: request.price,
            });
            await names.sell(username, Number(request.price), request.currency);
            console.log("Before sleep");
            await sleep(5000);
            console.log("After sleep");
            const nft: NamesData | undefined = await names.get({ username });
            console.log("NFT sale handleFunctionCall", nft);
            if (nft && nft.onSale == true) await algoliaWriteToken(nft);
            else console.error("Error NFT sale handleFunctionCall");
          }
          // "cannotsellnftforcurrencyprice": "Cannot sell NFT {{name}} for {{currency}} {{price}}"
          else
            await bot.tmessage("cannotsellnftforcurrencyprice", {
              name: username ? username.replaceAll("@", "") : "",
              currency: request.currency,
              price: request.price,
            });
          return;
        }
      }
    } catch (err) {
      console.error("Function error:", err);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { functions, handleFunctionCall };
