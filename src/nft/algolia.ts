import algoliasearch from "algoliasearch";
import removeMarkdown from "remove-markdown";
import NamesData from "../model/namesData";
import Names from "../connector/names";
import BotMessage from "../mina/message";

const ALGOLIA_KEY = process.env.ALGOLIA_KEY!;
const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT!;
const NAMES_TABLE = process.env.NAMES_TABLE!;

async function algoliaWriteTokens(): Promise<void> {
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const names = new Names(NAMES_TABLE);
    const bot = new BotMessage(process.env.SUPPORT_CHAT!);
    const tokens: NamesData[] = await names.scan();
    tokens.sort((a, b) => b.timeCreated - a.timeCreated);
    let success: boolean = true;
    console.log("alWriteTokens, number of tokens: ", tokens.length);
    await index.clearObjects();

    for (const token of tokens) {
        const ok = await algoliaWriteTokenHelper(token, index, bot);
        if (!ok) success = false;
    }
    await bot.support(
        success
            ? `Algolia index updated, ${tokens.length} tokens written`
            : "Error. Algolia index NOT updated",
    );
}

async function algoliaWriteToken(token: NamesData): Promise<void> {
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const bot = new BotMessage(process.env.SUPPORT_CHAT!);

    console.log("alWriteToken");

    const success = await algoliaWriteTokenHelper(token, index, bot);

    await bot.support(
        success
            ? `Algolia index updated, token ${token.username} written`
            : "Error. Algolia index NOT updated",
    );
}

async function algoliaWriteTokenHelper(
    token: NamesData,
    index: any,
    bot: BotMessage,
): Promise<boolean> {
    if (token.username !== token.uri.name) console.error("name mismatch");

    let params = token.uri;
    const description = removeMarkdown(token.uri.description);
    let shortdescription = description;
    if (shortdescription.length > 70) {
        shortdescription = description.slice(0, 70) + "...";
    }

    const name = token.uri.name;

    params.objectID = name;

    params.name = name;
    params.description = description;
    params.url = token.url ? token.url : "";
    params.category = "Mina NFT token";
    params.contract = "v1";
    params.chainId = "berkeley";
    params.tokenId = name;
    params.owner = name;
    params.updated = Date.now();

    params.shortdescription = shortdescription;
    params.markdown = token.uri.description;
    params.uri = "https://ipfs.io/ipfs/" + token.ipfs;
    params.onSale = token.onSale ? true : false;
    params.saleID = "";
    params.saleStatus = token.onSale ? "on sale" : "not on sale";
    params.price = token.price ? token.price : 0;
    params.currency = token.currency ? token.currency.toUpperCase() : "";
    params.sale = "";
    params.creator =
        token.creator && token.creator !== "" ? token.creator : "@MinaNFT_bot";

    //console.log("Algolia write ", token.username, params);

    try {
        const result = await index.saveObject(params);
        console.log(
            "Algolia write result for token",
            token.username,
            "is ",
            result,
        );
        return true;
    } catch (error) {
        console.error(" alWriteToken error: ", error);
        return false;
    }
}

async function getToken(name: string) {
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const filterStr = name ? `` : `name:${name}`;
    const objects = await index.search("", { filters: filterStr });
    console.log("Objects", objects, "filter", filterStr);

    if (objects.hits.length > 0) return objects.hits[0];
    else return undefined;
}

async function getTokenByIndex(id = 0) {
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const filterStr = ``;
    const objects = await index.search("", {
        filters: filterStr,
        offset: id,
        length: 1,
    });
    console.log("id", id, "Objects", objects, "filter", filterStr);
    if (objects.hits.length === 1) return objects.hits[0];
    else return undefined;
}

async function getSaleTokenByIndex(id = 0) {
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const filterStr = `(onSale:true)`;
    const objects = await index.search("", {
        filters: filterStr,
        offset: id,
        length: 1,
    });
    console.log("id", id, "Objects", objects, "filter", filterStr);
    if (objects.hits.length === 1) return objects.hits[0];
    else return undefined;
}

export {
    algoliaWriteTokens,
    algoliaWriteToken,
    getToken,
    getTokenByIndex,
    getSaleTokenByIndex,
};
