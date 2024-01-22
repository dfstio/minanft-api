import {
  PrivateKey,
  PublicKey,
  Poseidon,
  MerkleMap,
  Field,
  fetchAccount,
  Cache,
  verify,
  JsonProof,
} from "o1js";
import {
  MinaNFT,
  MapData,
  RedactedMinaNFT,
  MinaNFTNameServiceContract,
  MinaNFTContract,
  MinaNFTNameService,
  RedactedMinaNFTMapCalculation,
  MINANFT_NAME_SERVICE,
  VERIFICATION_KEY_HASH,
  accountBalanceMina,
  Memory,
  blockchain,
  sleep,
} from "minanft";
import { getFileData } from "../storage/filedata";
import { listFiles } from "./cache";
import S3File from "../storage/s3";
import { algoliaWriteToken } from "../nft/algolia";
import { getDeployer } from "./deployers";
import axios from "axios";
import { encrypt, decrypt, decryptJSON } from "../nft/kms";
import { minaInit, explorerTransaction } from "../mina/init";

import BotMessage from "./message";
import Names from "../table/names";
import { NamesData, BotMintData, KeyData } from "../model/namesData";
import { FilesTable } from "../table/files";
import { FileData } from "../model/fileData";
import MetadataTable from "../table/metadata";
import { Job } from "../table/job";

const { PINATA_JWT, NAMES_ORACLE_SK, METADATA_TABLE } = process.env;
const NAMES_TABLE = process.env.NAMES_TABLE!;
const FILES_TABLE = process.env.FILES_TABLE!;

interface LoadedNFT {
  nft: MinaNFT;
  name: NamesData;
  job: Job;
  bot: BotMessage;
  deployer: PrivateKey | undefined;
  nameService: MinaNFTNameService;
  ownerPrivateKey: PrivateKey;
  pinataJWT: string;
  keys: KeyData[];
}

/*
export interface KeyData {
  key: string;
  value: string;
  isPrivate: boolean;
}

export interface BotMintData {
  id: string;
  language: string;
  timeNow: number;
  filename: string;
  username: string;
  creator: string;
  description?: string;
  keys: KeyData[];
  files: string[];
}
*/

export async function deployNFT(params: BotMintData): Promise<void> {
  console.log("deployNFT", params);
  const {
    id,
    language,
    filename,
    timeNow,
    username,
    creator,
    description,
    keys: keysArg,
    files: filesArg,
  } = params;
  const job = new Job({
    id,
    task: "mint",
  });
  await job.start();
  const keys: KeyData[] = keysArg ?? [];
  const files: string[] = filesArg ?? [];
  const bot = new BotMessage(id, language);

  try {
    const names = new Names(NAMES_TABLE);
    const name = await names.get({ username });
    if (name) {
      console.log("Found old deployment", name);
      return;
    }

    console.time("all");
    Memory.info("start");
    minaInit();

    let filesToAdd: FileData[] = [];
    let imageMimeType: string = "";
    // check files

    const filesTable = new FilesTable(FILES_TABLE);
    const userFiles: FileData[] = await filesTable.listFiles(id);
    userFiles.map((file) => {
      if (files.includes(file.filename)) filesToAdd.push(file);
      if (filename === file.filename) imageMimeType = file.mimeType;
    });
    console.log("list_files", files, filesToAdd);
    if (filesToAdd.length !== files.length) {
      console.error("Files do not exist", {
        files,
        userFiles,
        filesToAdd,
        imageMimeType,
      });
      await bot.smessage("ErrordeployingNFT");
      await job.failed("Files do not exist");
      console.timeEnd("all");
      return;
    }

    if (imageMimeType === "") {
      console.error("Image file do not exists", {
        files,
        userFiles,
        filesToAdd,
        imageMimeType,
      });
      await bot.smessage("ErrordeployingNFT");
      await job.failed("Image file do not exists");
      console.timeEnd("all");
      return;
    }

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

    for (const key of keys) {
      if (
        key.key === undefined ||
        key.key === "" ||
        key.value === undefined ||
        key.value === ""
      ) {
        console.error("Wrong key format", key);
        await bot.smessage("ErrordeployingNFT");
        await job.failed("Wrong key format");
        console.timeEnd("all");
        return;
      }
      nft.update({
        key: key.key.substring(0, 30),
        value: key.value.substring(0, 30),
        isPrivate: key.isPrivate === true ? true : false,
      });
    }

    if (description !== undefined && description !== "") {
      nft.updateText({
        key: `description`,
        text: description,
      });
    }

    const imageData = await getFileData(id, filename, imageMimeType);
    const url = MinaNFT.urlFromStorageString(imageData.storage);
    nft.updateFileData({
      key: `image`,
      type: "image",
      data: imageData,
      isPrivate: false,
    });

    for (const file of filesToAdd) {
      const fileData = await getFileData(id, file.filename, file.mimeType);
      nft.updateFileData({
        key: file.filename.substring(0, 30),
        type: "file",
        data: fileData,
        isPrivate: false,
      });
    }

    console.log(`json:`, JSON.stringify(nft.toJSON(), null, 2));
    Memory.info("json");

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

    const deployer = await getDeployer();
    console.log(
      `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
    );

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
      explorer: explorerTransaction(),
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
    await bot.smessage("ErrordeployingNFT");
    await sleep(1000);
    console.timeEnd("all");
  }
}

export async function deployPost1(params: BotMintData): Promise<void> {
  console.log("deployPost", params);
  const {
    id,
    language,
    filename,
    timeNow,
    username,
    postname,
    creator,
    description,
    keys: keysArg,
    files: filesArg,
  } = params;
  const job = new Job({
    id,
    task: "post",
  });
  await job.start();
  const bot = new BotMessage(id, language);
  const keys: KeyData[] = keysArg ?? [];
  const files: string[] = filesArg ?? [];

  try {
    const names = new Names(NAMES_TABLE);
    const name = await names.get({ username });
    if (name) {
      console.log("Found old deployment", name);
      return;
    }

    console.time("all");
    Memory.info("start");
    minaInit();

    let filesToAdd: FileData[] = [];
    let imageMimeType: string = "";
    // check files

    const filesTable = new FilesTable(FILES_TABLE);
    const userFiles: FileData[] = await filesTable.listFiles(id);
    userFiles.map((file) => {
      if (files.includes(file.filename)) filesToAdd.push(file);
      if (filename === file.filename) imageMimeType = file.mimeType;
    });
    console.log("list_files", files, filesToAdd);
    if (filesToAdd.length !== files.length) {
      console.error("Files do not exist", {
        files,
        userFiles,
        filesToAdd,
        imageMimeType,
      });
      await bot.smessage("ErrordeployingNFT");
      await job.failed("Files do not exist");
      console.timeEnd("all");
      return;
    }

    if (imageMimeType === "") {
      console.error("Image file do not exists", {
        files,
        userFiles,
        filesToAdd,
        imageMimeType,
      });
      await bot.smessage("ErrordeployingNFT");
      await job.failed("Image file do not exists");
      console.timeEnd("all");
      return;
    }

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

    for (const key of keys) {
      if (
        key.key === undefined ||
        key.key === "" ||
        key.value === undefined ||
        key.value === ""
      ) {
        console.error("Wrong key format", key);
        await bot.smessage("ErrordeployingNFT");
        await job.failed("Wrong key format");
        console.timeEnd("all");
        return;
      }
      nft.update({
        key: key.key.substring(0, 30),
        value: key.value.substring(0, 30),
        isPrivate: key.isPrivate === true ? true : false,
      });
    }

    if (description !== undefined && description !== "") {
      nft.updateText({
        key: `description`,
        text: description,
      });
    }

    const imageData = await getFileData(id, filename, imageMimeType);
    const url = MinaNFT.urlFromStorageString(imageData.storage);
    nft.updateFileData({
      key: `image`,
      type: "image",
      data: imageData,
      isPrivate: false,
    });

    for (const file of filesToAdd) {
      const fileData = await getFileData(id, file.filename, file.mimeType);
      nft.updateFileData({
        key: file.filename.substring(0, 30),
        type: "file",
        data: fileData,
        isPrivate: false,
      });
    }

    console.log(`json:`, JSON.stringify(nft.toJSON(), null, 2));
    Memory.info("json");

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

    const deployer = await getDeployer();
    console.log(
      `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
    );

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
      explorer: explorerTransaction(),
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
    await bot.smessage("ErrordeployingNFT");
    await sleep(1000);
    console.timeEnd("all");
  }
}

async function loadNFT(params: {
  id: string;
  username: string;
  language: string;
  task: string;
  skipCompilation?: boolean;
}): Promise<LoadedNFT | undefined> {
  console.log("loadNFT", params);
  const { id, language, username, task, skipCompilation } = params;
  const job = new Job({
    id,
    task,
  });
  await job.start();
  const bot = new BotMessage(id, language);

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
      await job.failed("Wrong nft format or no nft");
      await bot.smessage("ErrordeployingNFT");
      return undefined;
    }

    console.time("all");
    Memory.info("start");
    minaInit();

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
    const uri = JSON.parse(metadataURI.privateUri);
    if (uri.properties === undefined) {
      console.error("Error getting properties", uri);
      await bot.smessage("ErrordeployingNFT");
      Memory.info("deploy error");
      await job.failed("Error decrypting metadata");
      return;
    }
    const keys = getKeysFromUri(uri.properties);
    await nft.loadMetadata(metadataURI.privateUri);
    let deployer: PrivateKey | undefined = undefined;

    const cacheDir = "/mnt/efs/cache";
    await listFiles(cacheDir);
    MinaNFT.setCacheFolder(cacheDir);

    if (skipCompilation !== true) {
      Memory.info("before compiling");
      console.log("Compiling...");

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

      deployer = await getDeployer();
      console.log(
        `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
      );
    }

    const nameService = new MinaNFTNameService({
      oraclePrivateKey,
      address: nameServiceAddress,
    });

    return {
      nft,
      name,
      job,
      bot,
      deployer,
      nameService,
      ownerPrivateKey,
      pinataJWT,
      keys,
    };
  } catch (err) {
    console.error(err);
    await job.failed("Wrong nft format or no nft");
    await bot.smessage("ErrordeployingNFT");
    return undefined;
  }
}

async function updateNFT(params: {
  id: string;
  language: string;
  nft: MinaNFT;
  name: NamesData;
  job: Job;
  bot: BotMessage;
  deployer: PrivateKey;
  nameService: MinaNFTNameService;
  ownerPrivateKey: PrivateKey;
  pinataJWT: string;
}): Promise<void> {
  const {
    id,
    language,
    nft,
    name,
    job,
    bot,
    deployer,
    nameService,
    ownerPrivateKey,
    pinataJWT,
  } = params;
  const uri = nft.exportToString({
    increaseVersion: true,
    includePrivateData: false,
  });

  const privateUri = nft.exportToString({
    increaseVersion: true,
    includePrivateData: true,
  });

  console.log(`privateUri:`, privateUri);
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
    nftname: nft.name,
    explorer: explorerTransaction(),
    hash: txId,
  });
  await MinaNFT.transactionInfo(tx, "commit", false);

  Memory.info("commit");

  let deployedNFT: NamesData = name;
  deployedNFT.uri = uri;
  deployedNFT.storage = nft.storage;

  console.log("Writing deployment to Names", deployedNFT);
  const names = new Names(NAMES_TABLE);
  await names.create(deployedNFT);
  await algoliaWriteToken(deployedNFT);

  const metadata = new MetadataTable(METADATA_TABLE!);
  const version = Number(nft.version.toBigInt());
  await metadata.createNewVersion({
    username: nft.name,
    version,
    uri: { username: nft.name, version, privateUri },
    txId,
  });

  //await bot.invoice(username.slice(1), image);
  Memory.info("end");
  await sleep(1000);
  await job.finish(txId);
  console.timeEnd("all");
}

export async function deployPost(params: BotMintData): Promise<void> {
  console.log("deployPost", params);
  const {
    id,
    language,
    filename,
    timeNow,
    username,
    postname,
    creator,
    description,
    keys: keysArg,
    files: filesArg,
  } = params;

  const keys: KeyData[] = keysArg ?? [];
  const files: string[] = filesArg ?? [];
  try {
    if (postname === undefined || postname === "") {
      console.error("No postname");
      return;
    }

    const loadedNFT = await loadNFT({
      id,
      language,
      username,
      task: "post",
    });

    if (loadedNFT === undefined) {
      console.error("Error loading NFT");
      return;
    }

    const {
      nft,
      job,
      bot,
      deployer,
      nameService,
      name,
      pinataJWT,
      ownerPrivateKey,
    } = loadedNFT;

    try {
      if (
        deployer === undefined ||
        ownerPrivateKey === undefined ||
        nameService === undefined ||
        pinataJWT === undefined
      ) {
        console.error("Error loading NFT");
        return;
      }

      const post = new MapData();
      post.update({ key: "name", value: postname.substring(0, 30) });
      post.update({ key: "post", value: "true" });
      post.update({ key: "time", value: Date.now().toString() });

      let filesToAdd: FileData[] = [];
      let imageMimeType: string = "";
      // check files

      const filesTable = new FilesTable(FILES_TABLE);
      const userFiles: FileData[] = await filesTable.listFiles(id);
      userFiles.map((file) => {
        if (files.includes(file.filename)) filesToAdd.push(file);
        if (filename === file.filename) imageMimeType = file.mimeType;
      });
      console.log("list_files", files, filesToAdd);
      if (filesToAdd.length !== files.length) {
        console.error("Files do not exist", {
          files,
          userFiles,
          filesToAdd,
          imageMimeType,
        });
        await bot.smessage("ErrordeployingNFT");
        await job.failed("Files do not exist");
        console.timeEnd("all");
        return;
      }

      if (imageMimeType === "") {
        console.error("Image file do not exists", {
          files,
          userFiles,
          filesToAdd,
          imageMimeType,
        });
        await bot.smessage("ErrordeployingNFT");
        await job.failed("Image file do not exists");
        console.timeEnd("all");
        return;
      }

      for (const key of keys) {
        if (
          key.key === undefined ||
          key.key === "" ||
          key.value === undefined ||
          key.value === ""
        ) {
          console.error("Wrong key format", key);
          await bot.smessage("ErrordeployingNFT");
          await job.failed("Wrong key format");
          console.timeEnd("all");
          return;
        }
        post.update({
          key: key.key.substring(0, 30),
          value: key.value.substring(0, 30),
          isPrivate: key.isPrivate === true ? true : false,
        });
      }

      if (description !== undefined && description !== "") {
        post.updateText({
          key: `description`,
          text: description,
        });
      }

      const imageData = await getFileData(id, filename, imageMimeType);
      const url = MinaNFT.urlFromStorageString(imageData.storage);
      post.updateFileData({
        key: `image`,
        fileData: imageData,
        isPrivate: false,
      });

      for (const file of filesToAdd) {
        const fileData = await getFileData(id, file.filename, file.mimeType);
        post.updateFileData({
          key: file.filename.substring(0, 30),
          fileData,
          isPrivate: false,
        });
      }

      nft.updateMap({ key: postname.substring(0, 30), map: post });

      await updateNFT({
        id,
        language,
        nft,
        name,
        job,
        bot,
        deployer,
        nameService,
        ownerPrivateKey,
        pinataJWT,
      });
    } catch (err) {
      console.error(err);
      await bot.smessage("ErrordeployingNFT");
      await job.failed("Files do not exist");
      console.timeEnd("all");
    }
  } catch (err) {
    console.error(err);
    console.timeEnd("all");
  }
}

export async function addKeys(params: {
  id: string;
  username: string;
  keys: KeyData[];
  language: string;
}): Promise<void> {
  console.log("addKeys", params);
  const { id, language, username, keys } = params;
  if (keys.length === 0) {
    console.error("No keys to add");
    return;
  }

  try {
    const loadedNFT = await loadNFT({
      id,
      language,
      username,
      task: "add_keys",
    });

    if (loadedNFT === undefined) {
      console.error("Error loading NFT");
      return;
    }

    const {
      nft,
      job,
      bot,
      deployer,
      nameService,
      name,
      pinataJWT,
      ownerPrivateKey,
    } = loadedNFT;

    if (
      deployer === undefined ||
      ownerPrivateKey === undefined ||
      nameService === undefined ||
      pinataJWT === undefined
    ) {
      console.error("Error loading NFT");
      return;
    }

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
      const keyStr = key.key.substring(0, 30);
      const valueStr = key.value.substring(0, 30);
      const isPrivate = key.isPrivate === true ? true : false;
      console.log(`addKeys key:`, keyStr, valueStr, isPrivate);
      nft.update({
        key: keyStr,
        value: valueStr,
        isPrivate,
      });
    }
    await updateNFT({
      id,
      language,
      nft,
      name,
      job,
      bot,
      deployer,
      nameService,
      ownerPrivateKey,
      pinataJWT,
    });
  } catch (err) {
    console.error(err);
  }
}

export async function verifyKeys(params: {
  id: string;
  username: string;
  proof: string;
  language: string;
}): Promise<void> {
  console.log("verifyKeys", params);
  const { id, language, username, proof } = params;
  const job = new Job({
    id,
    task: "verify",
  });
  await job.start();
  const bot = new BotMessage(id, language);
  async function failed() {
    await bot.smessage("proof.is.not.valid");
    await job.failed("Proof is not valid");
  }

  if (proof === undefined || proof === "") {
    console.error("No proof");
    await failed();
    return;
  }
  try {
    const fileKey = id + "/" + proof;
    const s3file = new S3File(process.env.BUCKET!, fileKey);
    const file = await s3file.get();
    //console.log(`file:`, file);
    const streamToString = await file.Body?.transformToString("utf8");
    if (streamToString === undefined) {
      console.error("Error loading proof", { streamToString });
      await failed();
      return;
    }
    const proofJson = JSON.parse(streamToString.toString());
    console.log("proofJson:", proofJson);
    if (proofJson === undefined) {
      console.error("Error loading proof");
      await failed();
      return;
    }
    const proofData = proofJson.proof;
    if (proofData === undefined) {
      console.error("Error loading proof");
      await failed();
      return;
    }
    const checkJson = await check(proofJson);
    if (!checkJson) {
      console.error("Error checking proof");
      await failed();
      return;
    } else console.log(`Metadata check  passed, compiling contract...`);
    const cacheDir = "/mnt/efs/cache";
    const cache: Cache = Cache.FileSystem(cacheDir);
    const verificationKey = (
      await RedactedMinaNFTMapCalculation.compile({ cache })
    ).verificationKey;
    const ok = await verify(proofData as JsonProof, verificationKey);
    if (!ok) {
      console.error("Error verifying proof");
      await failed();
      return;
    }

    console.log(`Proof is valid`);
    await job.finish("Proof is valid");
    await bot.smessage("proof.is.valid");
  } catch (e) {
    console.error(`Proof is not valid:`, e);
    await failed();
  }
}

export async function proveKeys(params: {
  id: string;
  username: string;
  keys: string[];
  language: string;
}): Promise<void> {
  console.log("proveKeys", params);
  const { id, language, username, keys } = params;
  if (keys.length === 0) {
    console.error("No keys to add");
    return;
  }

  try {
    const loadedNFT = await loadNFT({
      id,
      language,
      username,
      task: "prove_keys",
      skipCompilation: true,
    });

    if (loadedNFT === undefined) {
      console.error("Error loading NFT");
      return;
    }

    const {
      nft,
      job,
      bot,
      deployer,
      nameService,
      name,
      pinataJWT,
      ownerPrivateKey,
      keys: nftKeys,
    } = loadedNFT;

    const redactedNFT = new RedactedMinaNFT(nft);
    for (const key of keys) {
      console.log(`proveKeys key:`, key);
      redactedNFT.copyMetadata(key);
    }
    const proofKeys: { key: string; value: string }[] = [];
    for (const key of nftKeys) {
      console.log(`nft key:`, key);
      if (keys.includes(key.key)) {
        proofKeys.push({ key: key.key, value: key.value });
      }
    }

    const proof = await redactedNFT.proof(true);

    const proofJson = {
      name: nft.name,
      version: nft.version.toJSON(),
      address: nft.address.toBase58(),
      keys: proofKeys,
      proof: proof.toJSON(),
    };
    const data = JSON.stringify(proofJson, null, 2);
    console.log(`proofJson:`, data);
    const file: Buffer = Buffer.from(data);
    const filename = `${nft.name}.proof.json`;
    console.log(`filename:`, filename);
    await bot.file(file, filename);
    const fileKey = id + "/" + filename;
    const s3file = new S3File(process.env.BUCKET!, fileKey);
    await s3file.put(file, "application/json");
    const filesTable = new FilesTable(FILES_TABLE);
    await filesTable.create({
      id,
      filename,
      mimeType: "application/json",
      size: data.length,
      timeUploaded: Date.now(),
    });
    await s3file.wait();
    await bot.smessage("proof.generated");
    await job.finish(data);
    await sleep(2000);
  } catch (err) {
    console.error(err);
  }
}

export async function listKeys(params: {
  id: string;
  username: string;
}): Promise<KeyData[] | undefined> {
  console.log("listKeys", params);
  const { id, username } = params;

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

    /*
    minaInit();;
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const nft = new MinaNFT({
      name: username,
      address: PublicKey.fromBase58(name.publicKey),
      nameService: nameServiceAddress,
    });
    */
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
    //await nft.loadMetadata(metadataURI.privateUri);
    //console.log("metadata loaded");
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

function getKeysFromUri(properties: any): KeyData[] {
  const keys: KeyData[] = [];

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function check(json: any) {
  if (
    json.proof === undefined ||
    json.proof.publicInput === undefined ||
    json.proof.publicInput.length !== 6 ||
    json.keys === undefined ||
    json.keys.length !== parseInt(json.proof?.publicInput[5])
  ) {
    console.log("JSON proof error", json.proof);
    return false;
  }
  const data = new MerkleMap();
  const kind = new MerkleMap();
  let hash = Field(0);
  const str = MinaNFT.stringToField("string");
  for (let i = 0; i < json.keys.length; i++) {
    console.log("item", json.keys[i]);
    const key = MinaNFT.stringToField(json.keys[i].key);
    const value = MinaNFT.stringToField(json.keys[i].value);
    data.set(key, value);
    kind.set(key, str);
    /*
      hash: Poseidon.hash([
        element.key,
        element.value.data,
        element.value.kind,
      ]),
      hash: state1.hash.add(state2.hash),
      */
    hash = hash.add(Poseidon.hash([key, value, str]));
  }
  if (
    data.getRoot().toJSON() !== json.proof?.publicInput[2] ||
    kind.getRoot().toJSON() !== json.proof?.publicInput[3] ||
    hash.toJSON() !== json.proof?.publicInput[4]
  ) {
    console.error(
      "redacted metadata check error",
      data.getRoot().toJSON(),
      json.proof?.publicInput[2],
      kind.getRoot().toJSON(),
      json.proof?.publicInput[3]
    );
    return false;
  }

  minaInit();
  const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
  const zkNames = new MinaNFTNameServiceContract(nameServiceAddress);
  const zkApp = new MinaNFTContract(
    PublicKey.fromBase58(json.address),
    zkNames.token.id
  );
  await fetchAccount({ publicKey: zkApp.address, tokenId: zkNames.token.id });
  const metadata = zkApp.metadata.get();
  const version = zkApp.version.get();
  if (
    metadata.data.toJSON() !== json.proof?.publicInput[0] ||
    metadata.kind.toJSON() !== json.proof?.publicInput[1] ||
    version.toJSON() !== json.version.toString()
  ) {
    console.error(
      "metadata check error",
      metadata.data.toJSON(),
      json.proof?.publicInput[0],
      metadata.kind.toJSON(),
      json.proof?.publicInput[1],
      version.toJSON(),
      json.version.toString()
    );
    return false;
  }
  return true;
}
