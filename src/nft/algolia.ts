import algoliasearch from "algoliasearch";
import removeMarkdown from "remove-markdown";
import NamesData from "../model/namesData";
import Names from "../table/names";
import BotMessage from "../mina/message";

const ALGOLIA_KEY = process.env.ALGOLIA_KEY!;
const ALGOLIA_PROJECT = process.env.ALGOLIA_PROJECT!;
//const NAMES_TABLE = process.env.NAMES_TABLE!;
const NAMES_TABLE = process.env.TESTWORLD2_NAMES_TABLE!;

async function algoliaWriteTokens(): Promise<void> {
  const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
  const index = client.initIndex("minanft");
  const names = new Names(NAMES_TABLE);
  const bot = new BotMessage(process.env.SUPPORT_CHAT!, "en");
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
      : "Error. Algolia index NOT updated"
  );
}

async function algoliaWriteToken(token: NamesData): Promise<void> {
  const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
  const index = client.initIndex("minanft");
  const bot = new BotMessage(process.env.SUPPORT_CHAT!, "en");

  console.log("alWriteToken");

  const success = await algoliaWriteTokenHelper(token, index, bot);

  await bot.support(
    success
      ? `Algolia index updated, token ${token.username} written`
      : "Error. Algolia index NOT updated"
  );
}

async function algoliaWriteTokenHelper(
  token: NamesData,
  index: any,
  bot: BotMessage
): Promise<boolean> {
  if (token.username !== token.uri.name) console.error("name mismatch");

  let params = token.testworld2uri;
  const markdown = params.description;
  const description = removeMarkdown(params.description);
  let shortdescription = description;
  if (shortdescription.length > 70) {
    shortdescription = description.slice(0, 70) + "...";
  }

  const name = params.name;
  params.objectID = name;

  params.description = description;
  params.url = params.external_url;
  params.category = "Mina NFT token";
  params.contract = "v1";
  params.chainId = "testworld2";
  params.tokenId = name;
  params.owner = name;
  params.updated = Date.now();
  params.minaExplorer = process.env.MINAEXPLORER! + token.testworld2.publicKey;
  params.minaPublicKey = token.testworld2.publicKey;

  params.shortdescription = shortdescription;
  params.markdown = markdown;
  params.uri = token.testworld2.storage;
  params.onSale = token.onSale ? true : false;
  params.saleID = "";
  params.saleStatus = token.onSale ? "on sale" : "not on sale";
  params.price = token.price ? token.price : 0;
  params.currency = token.currency ? token.currency.toUpperCase() : "";
  params.sale = "";
  const creator = params.creator ?? "@MinaNFT_bot";
  params.creator = creator;

  // Put @minanft first in index always
  if (name == "@minanft") {
    params.time = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
    params.shortdescription =
      "Click here to explore @minanft's rich and diverse content, which includes video and AI-produced audio, as well as a PDF attachment of the MinaNFT pitch deck";
  }

  //console.log("Algolia write ", token.username, params);

  try {
    const result = await index.saveObject(params);
    console.log(
      "Algolia write result for token",
      token.username,
      "is ",
      result
    );
    return true;
  } catch (error) {
    console.error(" alWriteToken error: ", error);
    return false;
  }
}

/*

async function algoliaWriteTokens(): Promise<void> {
  const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
  const index = client.initIndex("minanft");
  const names = new Names(NAMES_TABLE);
  const bot = new BotMessage(process.env.SUPPORT_CHAT!, "en");
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
  const bot = new BotMessage(process.env.SUPPORT_CHAT!, "en");

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

  // Put @minanft first in index always
  if (name == "@minanft") {
    params.time = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
    params.shortdescription =
      "Click here to explore @minanft's rich and diverse content, which includes video and AI-produced audio, as well as a PDF attachment of the MinaNFT pitch deck";
  }

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
*/

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
