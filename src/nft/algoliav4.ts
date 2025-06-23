import algoliasearch from "algoliasearch";
import axios from "axios";
const { ALGOLIA_KEY, ALGOLIA_PROJECT, IPFS_URL, IPFS_TOKEN } = process.env;

async function loadFromIPFS(hash: string): Promise<any | undefined> {
  try {
    const url = IPFS_URL + hash + "?pinataGatewayToken=" + IPFS_TOKEN;
    const result = await axios.get(url);
    return result.data;
  } catch (error: any) {
    console.error("loadFromIPFS error:", error?.message ?? error);
    return undefined;
  }
}

export async function algoliaV4(params: {
  name: string;
  ipfs: string;
  contractAddress: string;
  owner: string;
  price: string;
  chain: string;
  status: string;
  jobId?: string;
  hash?: string;
}): Promise<boolean> {
  try {
    const {
      name,
      contractAddress,
      price,
      chain,
      ipfs,
      status,
      owner,
      hash,
      jobId,
    } = params;
    if (!ALGOLIA_KEY || !ALGOLIA_PROJECT) {
      console.error("ALGOLIA_KEY or ALGOLIA_PROJECT not set");
      return false;
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    if (chain !== "devnet" && chain !== "mainnet" && chain !== "zeko") {
      console.error("Invalid chain", chain);
      return false;
    }
    const index = client.initIndex(chain);
    const objectID = chain + "." + contractAddress + "." + name;
    /*
    const existing = await index.getObject(objectID);
    
    if (existing! == undefined && status === "failed") {
      console.error(
        "algolia: object already exists, will not update with failed status",
        objectID
      );
      return false;
    }
      */
    console.log("algoliaV4", params);
    const json = await loadFromIPFS(ipfs);
    if (name !== json.name)
      console.error("name mismatch", { name, jsonName: json.name });
    const data = {
      objectID,
      chain,
      contractAddress,
      owner,
      price,
      status,
      jobId,
      ipfs,
      hash,
      ...json,
    };

    const result = await index.saveObject(data);
    if (result.taskID === undefined) {
      console.error("mint-worker: Algolia write result is", result);
    }

    return true;
  } catch (error) {
    console.error("alWriteToken error:", { error, params });
    return false;
  }
}

export async function algoliaV4Transaction(params: {
  name: string;
  jobId: string;
  contractAddress: string;
  chain: string;
  hash?: string;
  status?: string;
  operation: string;
  price: string;
  sender: string;
}): Promise<boolean> {
  try {
    const { jobId, chain } = params;
    if (!ALGOLIA_KEY || !ALGOLIA_PROJECT) {
      console.error("ALGOLIA_KEY or ALGOLIA_PROJECT not set");
      return false;
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    if (chain !== "devnet" && chain !== "mainnet" && chain !== "zeko") {
      console.error("Invalid chain", chain);
      return false;
    }
    const index = client.initIndex(chain + "-txs");
    console.log("algoliaTransaction", params);
    const result = await index.saveObject({
      objectID: jobId,
      time: Date.now(),
      ...params,
    });
    if (result.taskID === undefined) {
      console.error(
        "mint-worker: algoliaTransaction: Algolia write result is",
        result
      );
    }

    return true;
  } catch (error) {
    console.error("mint-worker: algoliaTransaction error:", { error, params });
    return false;
  }
}

export async function algoliaIsExist(params: {
  name: string;
  contractAddress: string;
  chain: string;
}): Promise<boolean> {
  try {
    const { name, chain, contractAddress } = params;
    if (!ALGOLIA_KEY || !ALGOLIA_PROJECT) {
      console.error("ALGOLIA_KEY or ALGOLIA_PROJECT not set");
      return false;
    }
    const client = algoliasearch(ALGOLIA_PROJECT, ALGOLIA_KEY);
    if (chain !== "devnet" && chain !== "mainnet" && chain !== "zeko") {
      console.error("Invalid chain", chain);
      return false;
    }
    const index = client.initIndex(chain);
    const objectID = chain + "." + contractAddress + "." + name;

    const existing = await index.getObject(objectID);
    console.log("algoliaIsExist: existing object", existing);
    if (
      existing !== undefined &&
      ((existing as any)?.status !== "created" ||
        ((existing as any)?.time &&
          (existing as any)?.time > Date.now() - 1000 * 60 * 60))
    ) {
      console.error("algoliaIsExist: object already exists", params);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}
