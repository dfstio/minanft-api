"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFunctionCall = exports.functions = void 0;
const message_1 = __importDefault(require("../mina/message"));
const names_1 = __importDefault(require("../table/names"));
const NAMES_TABLE = process.env.NAMES_TABLE;
const algolia_1 = require("../nft/algolia");
const botcommands_1 = require("../payments/botcommands");
const currencies = ["USD", "EUR", "GBP", "CAD", "JPY"];
const functions = [
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
exports.functions = functions;
async function handleFunctionCall(id, message, username, language) {
    if (message && message.arguments) {
        try {
            const request = JSON.parse(message.arguments);
            const bot = new message_1.default(id, language);
            console.log("Arguments", request);
            if (message.name == "view") {
                console.log("Function view:", request);
                if (request.nft_name)
                    await bot.tmessage("letmeshowyou", { nftname: "NFT" + request.nft_name });
                else
                    await bot.tmessage("letmeshowyouall");
                await (0, botcommands_1.botCommandList)(id, language, request.nft_name);
                return;
            }
            if (message.name == "sell") {
                console.log("Function sell:", request);
                if (request.price && request.currency) {
                    if (currencies.includes(request.currency) &&
                        username &&
                        username !== "" &&
                        Number(request.price)) {
                        const names = new names_1.default(NAMES_TABLE);
                        await bot.tmessage("sellingnftforcurrencyprice", {
                            name: username ? username.replaceAll("@", "") : "",
                            currency: request.currency,
                            price: request.price
                        });
                        await names.sell(username, Number(request.price), request.currency);
                        await sleep(1000);
                        const nft = await names.get(username);
                        console.log("NFT sale handleFunctionCall", nft);
                        if (nft && nft.onSale == true)
                            await (0, algolia_1.algoliaWriteToken)(nft);
                        else
                            console.error("Error NFT sale handleFunctionCall");
                    }
                    else
                        await bot.tmessage("cannotsellnftforcurrencyprice", {
                            name: username ? username.replaceAll("@", "") : "",
                            currency: request.currency,
                            price: request.price
                        });
                    return;
                }
            }
        }
        catch (err) {
            console.error("Function error:", err);
            return;
        }
    }
}
exports.handleFunctionCall = handleFunctionCall;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=functions.js.map