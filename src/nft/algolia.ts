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

    for (const token of tokens) {
        if (token.username !== token.uri.name) console.error("name mismatch");
        console.log("alWriteToken", token.username);

        let params = token.uri;
        const description = removeMarkdown(token.uri.description);
        let shortdescription = description;
        if (shortdescription.length > 70) {
            shortdescription = description.slice(0, 70) + "...";
        }

        params.objectID = token.uri.name;
        params.updated = Date.now();
        params.description = description;
        params.shortdescription = shortdescription;
        params.markdown = token.uri.description;
        params.uri = "https://ipfs.io/ipfs/" + token.ipfs;

        console.log("Algolia write ", token.username, params);

        try {
            const result = await index.saveObject(params);
            console.log(
                "Algolia write result for token",
                token.username,
                "is ",
                result,
            );
        } catch (error) {
            console.error(" alWriteToken error: ", error);
            success = false;
        }
    }
    await bot.support(
        success ? "Algolia index updated" : "Error. Algolia index NOT updated",
    );
}

export { algoliaWriteTokens };
