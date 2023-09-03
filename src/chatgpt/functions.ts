import {
  ChatCompletionFunctions,
  ChatCompletionRequestMessageFunctionCall,
} from "openai";
import BotMessage from "../mina/message";
import Names from "../connector/names";
import NamesData from "../model/namesData";
const NAMES_TABLE = process.env.NAMES_TABLE!;
import { algoliaWriteToken } from "../nft/algolia";
import { botCommandList } from "../payments/botcommands";

const currencies: string[] = ["USD", "EUR", "GBP", "CAD", "JPY"];
const functions: ChatCompletionFunctions[] = [
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
  message: ChatCompletionRequestMessageFunctionCall,
  username: string | undefined,
): Promise<void> {
  if (message && message.arguments) {
    try {
      const request = JSON.parse(message.arguments);
      const bot = new BotMessage(id);
      console.log("Arguments", request);

      if (message.name == "view") {
        console.log("Function view:", request);
        await bot.message(
          `Let me show you ${
            request.nft_name ? "NFT" + request.nft_name : "all NFTs"
          }`,
        );
        await botCommandList(id, request.nft_name);
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
            await bot.message(
              `Selling NFT ${
                username ? username.replaceAll("@", "") : ""
              } for ${request.currency} ${request.price}`,
            );
            await names.sell(username, Number(request.price), request.currency);
            await sleep(1000);
            const nft: NamesData | undefined = await names.get(username);
            console.log("NFT sale handleFunctionCall", nft);
            if (nft && nft.onSale == true) await algoliaWriteToken(nft);
            else console.error("Error NFT sale handleFunctionCall");
          } else
            await bot.message(
              `Cannot sell NFT ${username ? username : ""} for ${
                request.currency
              } ${request.price}`,
            );
          return;
        }
      }
    } catch (err) {
      console.error("Function error:", err);
      return;
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { functions, handleFunctionCall };
