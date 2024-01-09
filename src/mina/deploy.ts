import { PrivateKey, PublicKey, Poseidon } from "o1js";
import {
  MinaNFT,
  MinaNFTNameService,
  MINANFT_NAME_SERVICE,
  VERIFICATION_KEY_HASH,
  accountBalanceMina,
  Memory,
  blockchain,
  sleep,
} from "minanft";
import { getFileData } from "../storage/filedata";
import { listFiles } from "./cache";
import { algoliaWriteToken } from "../nft/algolia";
import { getDeployer } from "./deployers";
import axios from "axios";
import { encrypt, decrypt, decryptJSON } from "../nft/kms";

import BotMessage from "./message";
import Names from "../table/names";
import { NamesData, BotMintData } from "../model/namesData";
import MetadataData from "../model/metadata";
import MetadataTable from "../table/metadata";
import { Job } from "../table/job";

const blockchainToDeploy: blockchain = "testworld2";

const { PINATA_JWT, NAMES_ORACLE_SK, METADATA_TABLE } = process.env;
const NAMES_TABLE = process.env.TESTWORLD2_NAMES_TABLE!;

export async function deployNFT(params: BotMintData): Promise<void> {
  console.log("deployNFT", params);
  const { id, language, filename, timeNow, username, creator } = params;
  const job = new Job({
    id,
    task: "mint",
  });
  await job.start();

  try {
    const names = new Names(NAMES_TABLE);
    const name = await names.get({ username });
    if (name) {
      console.log("Found old deployment", name);
      return;
    }

    const bot = new BotMessage(id, language);

    console.time("all");
    Memory.info("start");
    MinaNFT.minaInit(blockchainToDeploy);
    const deployer = await getDeployer();
    const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const ownerPrivateKey = PrivateKey.random();
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const privateKey = PrivateKey.random();
    const publicKey = privateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());
    const pinataJWT = PINATA_JWT!;

    const nft = new MinaNFT({
      name: username,
      creator:
        creator === ""
          ? "@MinaNFT_bot"
          : creator[0] === "@"
          ? creator
          : "@" + creator,
      address: publicKey,
      owner,
    });

    const imageData = await getFileData(id, filename);
    const url = MinaNFT.urlFromStorageString(imageData.storage);
    nft.updateFileData({
      key: `image`,
      type: "image",
      data: imageData,
      isPrivate: false,
    });
    console.log(`json:`, JSON.stringify(nft.toJSON(), null, 2));
    Memory.info("json");

    console.log(
      `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
    );

    const cacheDir = "/mnt/efs/cache";
    await listFiles(cacheDir);

    Memory.info("before compiling");
    console.log("Compiling...");
    MinaNFT.setCacheFolder(cacheDir);
    console.time("compiled");
    await MinaNFT.compile();
    console.timeEnd("compiled");
    Memory.info("after compiling");
    if (MinaNFT.verificationKey?.hash?.toJSON() !== VERIFICATION_KEY_HASH) {
      console.error(
        "Verification key is wrong",
        MinaNFT.verificationKey?.hash?.toJSON()
      );
      await bot.smessage("ErrordeployingNFT");
      Memory.info("deploy error");
      await job.failed("Verification key is wrong");
      console.timeEnd("all");
      return;
    }

    await sleep(1000);
    const image = `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${url}`;
    axios
      .get(image, {
        responseType: "arraybuffer",
      })
      .then((response: any) => {
        console.log("cloudinary ping - pinata");
      })
      .catch((e: any) => console.error("cloudinary ping - pinata", e));

    const nameService = new MinaNFTNameService({
      oraclePrivateKey,
      address: nameServiceAddress,
    });

    await sleep(2000);
    await bot.image(image, { caption: username.slice(1) });

    const uri = nft.exportToString({
      increaseVersion: true,
      includePrivateData: false,
    });

    const privateUri = nft.exportToString({
      increaseVersion: true,
      includePrivateData: true,
    });

    console.time("mint");
    const tx = await nft.mint({
      deployer,
      owner,
      pinataJWT,
      nameService,
      privateKey,
    });
    console.timeEnd("mint");
    Memory.info("mint");
    const txId = tx?.hash();
    if (tx === undefined || txId === undefined) {
      console.error("Error deploying NFT");
      await bot.smessage("ErrordeployingNFT");
      Memory.info("deploy error");
      await job.failed("deploy error");
      console.timeEnd("all");
      return;
    }

    await bot.tmessage("sucessDeploymentMessage", {
      nftname: username,
      hash: txId,
    });
    await MinaNFT.transactionInfo(tx, "mint", false);

    Memory.info("deployed");

    const privateKeyString = await encrypt(privateKey.toBase58(), nft.name);
    if (
      privateKeyString === undefined ||
      privateKey.toBase58() !== (await decrypt(privateKeyString, nft.name))
    ) {
      throw new Error("Error encrypting zkApp private key");
    }

    const ownerKeyString = await encrypt(ownerPrivateKey.toBase58(), nft.name);
    if (
      ownerKeyString === undefined ||
      ownerPrivateKey.toBase58() !== (await decrypt(ownerKeyString, nft.name))
    ) {
      throw new Error("Error encrypting owner private key");
    }

    let deployedNFT: NamesData = {
      username: nft.name,
      id,
      timeCreated: Date.now(),
      storage: nft.storage,
      uri,
      creator: nft.creator,
      language: language,
      privateKey: privateKeyString,
      ownerPrivateKey: ownerKeyString,
      publicKey: privateKey.toPublicKey().toBase58(),
    };

    console.log("Writing deployment to Names", deployedNFT);
    await names.create(deployedNFT);
    await algoliaWriteToken(deployedNFT);

    const metadata = new MetadataTable(METADATA_TABLE!);
    await metadata.createNewVersion({
      username: nft.name,
      version: 1,
      uri: { username, version: 1, privateUri },
      txId,
    });

    await bot.invoice(username.slice(1), image);
    Memory.info("end");
    await sleep(1000);
    await job.finish(txId);
    console.timeEnd("all");
  } catch (err) {
    console.error(err);
    await job.failed("deploy error");
  }
}

export async function addKeys(params: {
  id: string;
  username: string;
  keys: { key: string; value: string; isPrivate: boolean }[];
  language: string;
}): Promise<void> {
  console.log("addKeys", params);
  const { id, language, username, keys } = params;
  const job = new Job({
    id,
    task: "add_keys",
  });
  await job.start();

  try {
    if (keys.length === 0) {
      console.error("No keys to add");
      await job.failed("No keys to add");
      return;
    }
    const names = new Names(NAMES_TABLE);
    const name = await names.get({ username });
    if (
      name &&
      name.id === id &&
      name.ownerPrivateKey !== undefined &&
      name.ownerPrivateKey !== "" &&
      name.publicKey !== undefined &&
      name.publicKey !== ""
    ) {
      console.log("Found name record", name);
    } else {
      console.log("Wrong nft format or no nft", name);
      await job.failed("Wrong nft format or no nft");
      return;
    }

    const bot = new BotMessage(id, language);

    console.time("all");
    Memory.info("start");
    MinaNFT.minaInit(blockchainToDeploy);

    const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const ownerPrivateKeyStr = await decrypt(name.ownerPrivateKey, username);
    if (
      ownerPrivateKeyStr === undefined ||
      typeof ownerPrivateKeyStr !== "string"
    ) {
      console.error("Error decrypting owner private key");
      await bot.smessage("ErrordeployingNFT");
      Memory.info("deploy error");
      await job.failed("Error decrypting owner private key");
      return;
    }

    const ownerPrivateKey = PrivateKey.fromBase58(ownerPrivateKeyStr);
    const ownerPublicKey = ownerPrivateKey.toPublicKey();
    const owner = Poseidon.hash(ownerPublicKey.toFields());
    const pinataJWT = PINATA_JWT!;

    const nft = new MinaNFT({
      name: username,
      address: PublicKey.fromBase58(name.publicKey),
      owner,
      nameService: nameServiceAddress,
    });

    const currentURI = JSON.parse(name.uri);
    const metadataTable = new MetadataTable(METADATA_TABLE!);
    const currentPrivateURI = await metadataTable.get({
      username,
      version: Number(currentURI.version),
    });
    if (
      currentPrivateURI === undefined ||
      currentPrivateURI.metadata === undefined
    ) {
      console.error("Error getting current private URI", currentPrivateURI);
      await bot.smessage("ErrordeployingNFT");
      Memory.info("deploy error");
      await job.failed("Error getting current private URI");
      return;
    }

    const metadataURI = await decryptJSON(currentPrivateURI.metadata, username);
    if (metadataURI === undefined) {
      console.error("Error decrypting metadata");
      await bot.smessage("ErrordeployingNFT");
      Memory.info("deploy error");
      await job.failed("Error decrypting metadata");
      return;
    }
    console.log("metadataURI", metadataURI);
    await nft.loadMetadata(metadataURI.privateUri);
    for (const key of keys) {
      if (
        key.key === undefined ||
        key.key === "" ||
        key.value === undefined ||
        key.value === ""
      ) {
        console.error("Wrong key format", key);
        return;
      }
      nft.update({
        key: key.key,
        value: key.value,
        isPrivate: key.isPrivate === true ? true : false,
      });
    }

    const cacheDir = "/mnt/efs/cache";
    await listFiles(cacheDir);

    Memory.info("before compiling");
    console.log("Compiling...");
    MinaNFT.setCacheFolder(cacheDir);
    console.time("compiled");
    await MinaNFT.compile();
    console.timeEnd("compiled");
    Memory.info("after compiling");
    if (MinaNFT.verificationKey?.hash?.toJSON() !== VERIFICATION_KEY_HASH) {
      console.error(
        "Verification key is wrong",
        MinaNFT.verificationKey?.hash?.toJSON()
      );
      await bot.smessage("ErrordeployingNFT");
      Memory.info("deploy error");
      console.timeEnd("all");
      await bot.smessage("ErrordeployingNFT");
      await job.failed("Verification key is wrong");
      return;
    }

    const deployer = await getDeployer();
    console.log(
      `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
    );

    await sleep(1000);

    const nameService = new MinaNFTNameService({
      oraclePrivateKey,
      address: nameServiceAddress,
    });

    const uri = nft.exportToString({
      increaseVersion: true,
      includePrivateData: false,
    });

    const privateUri = nft.exportToString({
      increaseVersion: true,
      includePrivateData: true,
    });

    console.time("commit");
    const tx = await nft.commit({
      deployer,
      pinataJWT,
      nameService,
      ownerPrivateKey,
    });
    console.timeEnd("commit");
    Memory.info("mint");
    const txId = tx?.hash();
    if (tx === undefined || txId === undefined) {
      console.error("Error deploying NFT");
      await bot.smessage("ErrordeployingNFT");
      Memory.info("deploy error");
      await job.failed("deploy error");
      console.timeEnd("all");
      return;
    }

    await bot.tmessage("sucessDeploymentMessage", {
      nftname: username,
      hash: txId,
    });
    await MinaNFT.transactionInfo(tx, "commit", false);

    Memory.info("commit");

    let deployedNFT: NamesData = name;
    deployedNFT.uri = uri;
    deployedNFT.storage = nft.storage;

    console.log("Writing deployment to Names", deployedNFT);
    await names.create(deployedNFT);
    await algoliaWriteToken(deployedNFT);

    const metadata = new MetadataTable(METADATA_TABLE!);
    const version = Number(nft.version.toBigInt());
    await metadata.createNewVersion({
      username: nft.name,
      version,
      uri: { username, version, privateUri },
      txId,
    });

    //await bot.invoice(username.slice(1), image);
    Memory.info("end");
    await sleep(1000);
    await job.finish(txId);
    console.timeEnd("all");
  } catch (err) {
    console.error(err);
  }
}

export async function listKeys(params: {
  id: string;
  username: string;
  language: string;
}): Promise<{ key: string; value: string; isPrivate: boolean }[] | undefined> {
  console.log("listKeys", params);
  const { id, language, username } = params;

  try {
    const names = new Names(NAMES_TABLE);
    const name = await names.get({ username });
    if (
      name &&
      name.id === id &&
      name.ownerPrivateKey !== undefined &&
      name.ownerPrivateKey !== "" &&
      name.publicKey !== undefined &&
      name.publicKey !== ""
    ) {
      console.log("Found name record", name);
    } else {
      console.log("Wrong nft format or no nft", name);
      return;
    }

    MinaNFT.minaInit(blockchainToDeploy);
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const nft = new MinaNFT({
      name: username,
      address: PublicKey.fromBase58(name.publicKey),
      nameService: nameServiceAddress,
    });

    const currentURI = JSON.parse(name.uri);
    const metadataTable = new MetadataTable(METADATA_TABLE!);
    const currentPrivateURI = await metadataTable.get({
      username,
      version: Number(currentURI.version),
    });
    if (
      currentPrivateURI === undefined ||
      currentPrivateURI.metadata === undefined
    ) {
      console.error("Error getting current private URI", currentPrivateURI);
      return;
    }

    const metadataURI = await decryptJSON(currentPrivateURI.metadata, username);
    if (metadataURI === undefined) {
      console.error("Error decrypting metadata");
      return;
    }
    console.log("metadataURI", metadataURI);
    await nft.loadMetadata(metadataURI.privateUri);
    const uri = JSON.parse(metadataURI.privateUri);
    if (uri.properties === undefined) {
      console.error("Error getting properties", uri);
      return;
    }
    const keys = getKeysFromUri(uri.properties);
    return keys;
  } catch (err) {
    console.error("listKeys", err);
  }
  return undefined;
}

function getKeysFromUri(
  properties: any
): { key: string; value: string; isPrivate: boolean }[] {
  const keys: { key: string; value: string; isPrivate: boolean }[] = [];

  function iterateProperties(properties: any, level = 0) {
    for (const key in properties) {
      //console.log(`key:`, key, properties[key]);

      switch (properties[key].kind) {
        case "string":
          keys.push({
            key: key,
            value: properties[key].data,
            isPrivate: properties[key].isPrivate ?? false,
          });
          break;

        default:
          break;
      }
    }
  }
  try {
    iterateProperties(properties);
  } catch (error) {
    console.error(`Error: ${error}`);
  }

  return keys;
}
