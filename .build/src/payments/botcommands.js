"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.botCommandCallback = exports.botCommandBuy = exports.botCommandList = exports.supportTicket = void 0;
const telegraf_1 = require("telegraf");
const message_1 = __importDefault(require("../mina/message"));
const algolia_1 = require("../nft/algolia");
const stripe_1 = require("../payments/stripe");
const lang_1 = require("../lang/lang");
async function supportTicket(id, language) {
    const bot = new message_1.default(id, language);
    await bot.supportTicket();
}
exports.supportTicket = supportTicket;
async function botCommandList(chatId, language, name = undefined) {
    try {
        const bot = new message_1.default(chatId, language);
        const id = 0;
        let token = undefined;
        if (name)
            token = await (0, algolia_1.getToken)(name.substr(0, 1) == "@" ? name : "@" + name);
        if (!token)
            token = await (0, algolia_1.getTokenByIndex)(id);
        if (token && token.image && token.name) {
            const prev = id === 0 ? 0 : id - 1;
            const next = id + 1;
            await bot.image(`https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`, {
                caption: token.onSale
                    ? `MinaNFT ${token.name.replaceAll("@", "")}\nPrice: ${token.currency.toUpperCase()} ${token.price}`
                    : `MinaNFT ${token.name.replaceAll("@", "")}`,
                parse_mode: "Markdown",
                ...telegraf_1.Markup.inlineKeyboard(token.onSale
                    ? [
                        telegraf_1.Markup.button.callback("Buy", JSON.stringify({ a: "by", id: id })),
                        telegraf_1.Markup.button.callback("<️", JSON.stringify({ a: "list", id: prev }), id === 0 ? true : false),
                        telegraf_1.Markup.button.callback(">️", JSON.stringify({ a: "list", id: next })),
                    ]
                    : [
                        telegraf_1.Markup.button.callback("<️", JSON.stringify({ a: "list", id: prev }), id === 0 ? true : false),
                        telegraf_1.Markup.button.callback(">️", JSON.stringify({ a: "list", id: next })),
                    ]),
            });
        }
        else
            await bot.tmessage("ErrorloadingNFT");
    }
    catch (err) {
        console.error("botCommandList - catch", err);
    }
}
exports.botCommandList = botCommandList;
async function botCommandBuy(chatId, language, name = undefined) {
    try {
        const bot = new message_1.default(chatId, language);
        const id = 0;
        let token = undefined;
        if (name)
            token = await (0, algolia_1.getToken)(name.substr(0, 1) == "@" ? name.substr(1, 31) : name.substr(0, 30));
        if (!token)
            token = await (0, algolia_1.getSaleTokenByIndex)(id);
        if (token && token.image && token.name) {
            const prev = id === 0 ? 0 : id - 1;
            const next = id + 1;
            await bot.image(`https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`, {
                caption: `MinaNFT ${token.name.replaceAll("@", "")}\nPrice: ${token.currency.toUpperCase()} ${token.price}`,
                parse_mode: "Markdown",
                ...telegraf_1.Markup.inlineKeyboard([
                    telegraf_1.Markup.button.callback("Buy", JSON.stringify({ a: "buy", id: id })),
                    telegraf_1.Markup.button.callback("<️", JSON.stringify({ a: "load", id: prev }), id === 0 ? true : false),
                    telegraf_1.Markup.button.callback(">️", JSON.stringify({ a: "load", id: next })),
                ]),
            });
        }
        else
            await bot.tmessage("ErrorloadingNFT");
    }
    catch (err) {
        console.error("botCommandBuy - catch", err);
    }
}
exports.botCommandBuy = botCommandBuy;
async function botCommandCallback(ctx) {
    try {
        console.log("botCommandCallback", ctx, ctx.update.callback_query, ctx.update.callback_query.from);
        if (ctx &&
            ctx.update &&
            ctx.update.callback_query &&
            ctx.update.callback_query.from &&
            ctx.update.callback_query.from.id &&
            ctx.update.callback_query.data) {
            console.log("botCommandCallback data", ctx.update.callback_query.data, ctx.update.callback_query, ctx.update.callback_query.from);
            const data = JSON.parse(ctx.update.callback_query.data);
            console.log("callback_query data", data);
            await (0, lang_1.initLanguages)();
            const language = await (0, lang_1.getLanguage)(ctx.update.callback_query.from.id);
            const T = (0, lang_1.getT)(language);
            let id = parseInt(data.id);
            const action = data.a;
            let tokenId = 0;
            const isList = action == "by" || action == "list";
            let token = isList
                ? await (0, algolia_1.getTokenByIndex)(id)
                : await (0, algolia_1.getSaleTokenByIndex)(id);
            console.log("show token", id, token);
            if (!token) {
                id = 0;
                token = await (0, algolia_1.getTokenByIndex)(id);
            }
            await ctx.answerCbQuery(`Loading NFT ${token && token.name ? token.name : ""}`);
            if (token) {
                if (action === "load" || action === "list") {
                    const prev = id === 0 ? 0 : id - 1;
                    const next = id + 1;
                    const replyOptions = telegraf_1.Markup.inlineKeyboard(token.onSale
                        ? [
                            telegraf_1.Markup.button.callback("Buy", JSON.stringify({
                                a: isList ? "by" : "buy",
                                id: id,
                            })),
                            telegraf_1.Markup.button.callback("<️", JSON.stringify({
                                a: isList ? "list" : "load",
                                id: prev,
                            }), id === 0 ? true : false),
                            telegraf_1.Markup.button.callback(">️", JSON.stringify({
                                a: isList ? "list" : "load",
                                id: next,
                            })),
                        ]
                        : [
                            telegraf_1.Markup.button.callback("<️", JSON.stringify({
                                a: isList ? "list" : "load",
                                id: prev,
                            }), id === 0 ? true : false),
                            telegraf_1.Markup.button.callback(">️", JSON.stringify({
                                a: isList ? "list" : "load",
                                id: next,
                            })),
                        ]);
                    await ctx.editMessageMedia({
                        type: "photo",
                        media: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`,
                        caption: token.onSale
                            ? `MinaNFT ${token.name.replaceAll("@", "")}\nPrice: ${token.currency.toUpperCase()} ${token.price}`
                            : `MinaNFT ${token.name.replaceAll("@", "")}`,
                        parse_mode: "Markdown",
                    }, replyOptions);
                }
                else if (action === "buy" || action === "by") {
                    const stripeMsg = await ctx.replyWithInvoice((0, stripe_1.buyInvoice)(token, T));
                }
            }
        }
    }
    catch (err) {
        console.error("botCommandCallback - catch", err);
    }
}
exports.botCommandCallback = botCommandCallback;
//# sourceMappingURL=botcommands.js.map