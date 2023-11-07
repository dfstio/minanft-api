"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSaleTokenByIndex = exports.getTokenByIndex = exports.getToken = exports.algoliaWriteToken = exports.algoliaWriteTokens = void 0;
const algoliasearch_1 = __importDefault(require("algoliasearch"));
const remove_markdown_1 = __importDefault(require("remove-markdown"));
const names_1 = __importDefault(require("../table/names"));
const message_1 = __importDefault(require("../mina/message"));
const ALGOLIA_KEY = process.env.ALGOLIA_KEY;
const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT;
const NAMES_TABLE = process.env.NAMES_TABLE;
async function algoliaWriteTokens() {
    const client = (0, algoliasearch_1.default)(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const names = new names_1.default(NAMES_TABLE);
    const bot = new message_1.default(process.env.SUPPORT_CHAT, "en");
    const tokens = await names.scan();
    tokens.sort((a, b) => b.timeCreated - a.timeCreated);
    let success = true;
    console.log("alWriteTokens, number of tokens: ", tokens.length);
    await index.clearObjects();
    for (const token of tokens) {
        const ok = await algoliaWriteTokenHelper(token, index, bot);
        if (!ok)
            success = false;
    }
    await bot.support(success
        ? `Algolia index updated, ${tokens.length} tokens written`
        : "Error. Algolia index NOT updated");
}
exports.algoliaWriteTokens = algoliaWriteTokens;
async function algoliaWriteToken(token) {
    const client = (0, algoliasearch_1.default)(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const bot = new message_1.default(process.env.SUPPORT_CHAT, "en");
    console.log("alWriteToken");
    const success = await algoliaWriteTokenHelper(token, index, bot);
    await bot.support(success
        ? `Algolia index updated, token ${token.username} written`
        : "Error. Algolia index NOT updated");
}
exports.algoliaWriteToken = algoliaWriteToken;
async function algoliaWriteTokenHelper(token, index, bot) {
    if (token.username !== token.uri.name)
        console.error("name mismatch");
    let params = token.uri;
    const description = (0, remove_markdown_1.default)(token.uri.description);
    let shortdescription = description;
    if (shortdescription.length > 70) {
        shortdescription = description.slice(0, 70) + "...";
    }
    const name = token.uri.name[0] == "@" ? token.uri.name : "@" + token.uri.name;
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
    if (name == "@minanft") {
        params.time = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
        params.shortdescription =
            "Click here to explore @minanft's rich and diverse content, which includes video and AI-produced audio, as well as a PDF attachment of the MinaNFT pitch deck";
    }
    try {
        const result = await index.saveObject(params);
        console.log("Algolia write result for token", token.username, "is ", result);
        return true;
    }
    catch (error) {
        console.error(" alWriteToken error: ", error);
        return false;
    }
}
async function getToken(name) {
    const client = (0, algoliasearch_1.default)(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const filterStr = name ? `` : `name:${name}`;
    const objects = await index.search("", { filters: filterStr });
    console.log("Objects", objects, "filter", filterStr);
    if (objects.hits.length > 0)
        return objects.hits[0];
    else
        return undefined;
}
exports.getToken = getToken;
async function getTokenByIndex(id = 0) {
    const client = (0, algoliasearch_1.default)(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const filterStr = ``;
    const objects = await index.search("", {
        filters: filterStr,
        offset: id,
        length: 1,
    });
    console.log("id", id, "Objects", objects, "filter", filterStr);
    if (objects.hits.length === 1)
        return objects.hits[0];
    else
        return undefined;
}
exports.getTokenByIndex = getTokenByIndex;
async function getSaleTokenByIndex(id = 0) {
    const client = (0, algoliasearch_1.default)(ALGOLIA_PROJECT, ALGOLIA_KEY);
    const index = client.initIndex("minanft");
    const filterStr = `(onSale:true)`;
    const objects = await index.search("", {
        filters: filterStr,
        offset: id,
        length: 1,
    });
    console.log("id", id, "Objects", objects, "filter", filterStr);
    if (objects.hits.length === 1)
        return objects.hits[0];
    else
        return undefined;
}
exports.getSaleTokenByIndex = getSaleTokenByIndex;
//# sourceMappingURL=algolia.js.map