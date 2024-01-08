import algoliasearch from "algoliasearch";
import removeMarkdown from "remove-markdown";
import { NamesData } from "../model/namesData";
import Names from "../table/names";
import BotMessage from "../mina/message";
import { MinaNFT } from "minanft";
import { kind } from "openai/_shims";
import OwnersTable from "../table/owners";

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
    if (token.uri !== undefined) {
      const ok = await algoliaWriteTokenHelper(token, index, bot);
      if (!ok) {
        success = false;
        console.error("Error writing token", token);
      }
    } else console.log("Skipping token", token.username);
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
  try {
    console.log("algoliaWriteTokenHelper", token.username);
    if (token.ownerPrivateKey !== undefined && token.ownerPrivateKey !== "") {
      const owners = new OwnersTable(process.env.OWNERS_TABLE!);
      await owners.create({
        id: token.id,
        username: token.username,
      });
    }

    let params = JSON.parse(token.uri);
    if (token.username !== params.name) console.error("name mismatch");
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
    params.category =
      params.properties?.category?.kind === "string"
        ? params.properties?.category?.data ?? "MinaNFT token"
        : "MinaNFT token";
    params.type = "nft";
    params.contract = "v1";
    params.chainId = "testworld2";
    params.tokenId = name;
    params.updated = Date.now();
    params.minaExplorer = process.env.MINAEXPLORER! + token.publicKey;
    params.minaPublicKey = token.publicKey;

    params.shortdescription = shortdescription;
    params.markdown = markdown;
    params.uri = token.storage
      ? MinaNFT.urlFromStorageString(token.storage)
      : "";
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

    const result = await index.saveObject(params);

    console.log(
      "Algolia write result for token",
      token.username,
      "is ",
      result
    );

    const ok = await algoliaWritePosts(token, params, index, bot);

    return ok;
  } catch (error) {
    console.error(" alWriteToken error: ", error, token);
    return false;
  }
}

async function algoliaWritePosts(
  token: NamesData,
  params: any,
  index: any,
  bot: BotMessage
): Promise<boolean> {
  //console.log(`algoliaWritePosts:`, params);
  let ok = true;
  try {
    async function iterateProperties(properties: any) {
      //console.log(`iterateProperties:`, properties);
      for (const key in properties) {
        switch (properties[key].kind) {
          case "map":
            //console.log(`iterateProperties key:`, key, properties[key]);
            if (
              properties[key].linkedObject?.properties?.post?.data === "true" &&
              properties[key].linkedObject?.properties !== undefined
            ) {
              //console.log(`post:`, properties[key].linkedObject.properties);
              const result = await algoliaWritePostHelper(
                token,
                params,
                properties[key].linkedObject.properties,
                key,
                index,
                bot
              );
              if (!result) ok = false;
            }
            break;

          default:
            break;
        }
      }
    }

    await iterateProperties(params.properties);
    return ok;
  } catch (error) {
    console.error("algoliaWritePosts error: ", error, token);
    return false;
  }
}

async function algoliaWritePostHelper(
  token: NamesData,
  nft: any,
  post: any,
  key: string,
  index: any,
  bot: BotMessage
): Promise<boolean> {
  try {
    console.log("algoliaWritePostHelper", key, post);
    if (post === undefined) {
      console.error("algoliaWritePostHelper: Empty post");
      return false;
    }
    const name = post.name.kind === "string" ? post.name.data ?? key : key;
    if (key !== name) console.error("name mismatch");
    const nftName = nft.name;
    const imageUrl =
      post.image?.kind === "file"
        ? post.image?.linkedObject?.storage ?? ""
        : "";
    let params: any = {
      name: name,
      description:
        post.description?.kind === "text"
          ? post.description.linkedObject?.text ?? ""
          : "",
      nft: nftName,
      time: post.time?.kind === "string" ? Number(post.time.data) ?? 0 : 0,
      image: imageUrl === "" ? "" : MinaNFT.urlFromStorageString(imageUrl),
      properties: post,
    };

    const markdown = params.description;
    const description = removeMarkdown(params.description);
    let shortdescription = description;
    if (shortdescription.length > 70) {
      shortdescription = description.slice(0, 70) + "...";
    }
    params.objectID = nftName + "." + name;

    params.description = description;
    params.url = nft.external_url;
    params.category = nft.category ?? "MinaNFT post";
    params.type = "post";
    params.contract = "v1";
    params.chainId = "testworld2";
    params.tokenId = name;
    params.owner = nft.owner ?? "";
    params.updated = Date.now();
    params.minaExplorer = process.env.MINAEXPLORER! + token.publicKey;
    params.minaPublicKey = token.publicKey;

    params.shortdescription = shortdescription;
    params.markdown = markdown;
    params.uri = token.storage
      ? MinaNFT.urlFromStorageString(token.storage)
      : "";
    params.onSale = false;
    params.saleID = "";
    params.saleStatus = "not on sale";
    params.price = 0;
    params.currency = "";
    params.sale = "";
    const creator = nft.creator ?? "@MinaNFT_bot";
    params.creator = creator;

    console.log("Algolia write post", name, params);

    const result = await index.saveObject(params);

    console.log(
      "Algolia write result for post",
      params.objectID,
      "is ",
      result
    );

    return true;
  } catch (error) {
    console.error("algoliaWritePostHelper error: ", error, token);
    return false;
  }
}

/*

async function algoliaWriteTokenHelper(
  token: NamesData,
  index: any,
  bot: BotMessage
): Promise<boolean> {
  try {
    console.log("algoliaWriteTokenHelper", token.username, token);
    if (token.username === "@test_574835") console.log("@test_574835", token);
    if (token.username !== token.uri.name) console.error("name mismatch");

    let params = JSON.parse(token.uri);
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
    params.minaExplorer = process.env.MINAEXPLORER! + token.publicKey;
    params.minaPublicKey = token.publicKey;

    params.shortdescription = shortdescription;
    params.markdown = markdown;
    params.uri = token.storage;
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

    const result = await index.saveObject(params);
  
    console.log(
      "Algolia write result for token",
      token.username,
      "is ",
      result
    );
    
    return true;
  } catch (error) {
    console.error(" alWriteToken error: ", error, token);
    return false;
  }
}


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
