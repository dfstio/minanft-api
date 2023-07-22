import { Telegraf, Markup } from "telegraf";
import BotMessage from "../mina/message";
import { getTokens, getTokenByIndex } from "../nft/algolia";

/*
new - Create new NFT
list - List all NFTs
secret - Get secret key of your NFT 		
support - Buy support ticket 
sell - Sell NFT
buy - Buy NFT 		
*/

async function supportTicket(id: string): Promise<void> {
    const bot = new BotMessage(id);
    await bot.supportTicket();
}

async function botCommandList(chatId: string): Promise<void> {
    const bot = new BotMessage(chatId);
    // await bot.supportTicket();

    const id: number = 0;
    let token: any = await getTokenByIndex(id);
    if (token && token.image && token.name) {
        const prev = id === 0 ? 0 : id - 1;
        const next = id + 1;
        await bot.image(
            `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`,
            {
                caption: `MinaNFT @${token.name}`,
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    Markup.button.callback(
                        "<️",
                        JSON.stringify({ a: "load", id: prev }),
                        id === 0 ? true : false,
                    ),
                    Markup.button.callback(
                        ">️",
                        JSON.stringify({ a: "load", id: next }),
                    ),
                ]),
            },
        );
    } else await bot.message("Error loading NFT");
}

async function botCommandCallback(ctx: any): Promise<void> {
    console.log("botCommandCallback", ctx);
    if (
        ctx &&
        ctx.update &&
        ctx.update.callback_query &&
        ctx.update.callback_query.from &&
        ctx.update.callback_query.from.id &&
        ctx.update.callback_query.data
    ) {
        const data = JSON.parse(ctx.update.callback_query.data);
        console.log("callback_query data", data);

        let id = parseInt(data.id);
        const action = data.a;
        let tokenId = 0;
        let token: any = await getTokenByIndex(id);
        console.log("show token", id, token);
        if (!token) {
            id = 0;
            token = await getTokenByIndex(id);
        }
        await ctx.answerCbQuery(
            `Loading NFT ${token && token.name ? token.name : ""}`,
        );

        if (token) {
            if (action === "load") {
                //ctx.telegram.sendMessage(ctx.message.chat.id, `${token.tokenId}: ${token.name} Price: ${token.currency.toUpperCase()} ${token.price}\n`)
                const prev = id === 0 ? 0 : id - 1;
                const next = id + 1;

                const replyOptions = Markup.inlineKeyboard([
                    Markup.button.callback(
                        "<️",
                        JSON.stringify({ a: "load", id: prev }),
                        id === 0 ? true : false,
                    ),
                    Markup.button.callback(
                        ">️",
                        JSON.stringify({ a: "load", id: next }),
                    ),
                ]);

                await ctx.editMessageMedia(
                    {
                        type: "photo",
                        media: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`,
                        caption: `MinaNFT @${token.name}`,
                        parse_mode: "Markdown",
                    },
                    replyOptions,
                );
            } else if (action === "buy") {
                //const stripeMsg = await ctx.replyWithInvoice(stripeInvoice(token));
            }
        }
    }
}

export { supportTicket, botCommandList, botCommandCallback };
