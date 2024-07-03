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
  VerificationKey,
  UInt64,
  Mina,
} from "o1js";
import {
  MinaNFT,
  MapData,
  accountBalanceMina,
  Memory,
  blockchain,
  sleep,
  RollupNFT,
  serializeFields,
  Metadata,
  Storage,
  MINANFT_NAME_SERVICE_V2,
  MinaNFTNameServiceV2,
  VERIFICATION_KEY_V2_JSON,
  NFTContractV2,
  NameContractV2,
  initBlockchain,
  wallet,
  MintParams,
  fetchMinaAccount,
} from "minanft";
import { getFileData } from "../storage/filedata";
import { listFiles } from "./cache";
import S3File from "../storage/s3";
import { algoliaWriteToken } from "../nft/algolia";
import { getDeployer } from "./deployers";
import axios from "axios";
import { encrypt, decrypt, decryptJSON } from "../nft/kms";
import { minaInit, explorerTransaction } from "../mina/init";

import BotMessage from "../chatgpt/message";
import Names from "../table/names";
import { NamesData, BotMintData, KeyData } from "../model/namesData";
import { FilesTable } from "../table/files";
import { FileData } from "../model/fileData";
import MetadataTable from "../table/metadata";
import { Job } from "../table/job";
import { nftPrice } from "../payments/pricing";
import { algoliaV4 } from "../nft/algoliav4";

const { PINATA_JWT, NAMES_ORACLE_SK, METADATA_TABLE } = process.env;
const NAMES_TABLE = process.env.NAMES_TABLE!;
const FILES_TABLE = process.env.FILES_TABLE!;
let nftVerificationKey: VerificationKey | undefined = undefined;
let nameVerificationKey: VerificationKey | undefined = undefined;

interface LoadedNFT {
  nft: RollupNFT;
  name: NamesData;
  job: Job;
  bot: BotMessage;
  deployer: PrivateKey | undefined;
  nameService: MinaNFTNameServiceV2;
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

export async function deployNFTV4(params: BotMintData): Promise<void> {
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
    chain: chainArg,
  } = params;
  const job = new Job({
    id,
    task: "mint",
  });
  await job.start();
  const keys: KeyData[] = keysArg ?? [];
  const files: string[] = filesArg ?? [];
  const chain: blockchain = "devnet";
  const bot = new BotMessage(id, language);

  try {
    const names = new Names(NAMES_TABLE);
    const reservedName = await names.getReservedName({ username });
    if (reservedName) {
      console.log("Found old deployment", reservedName);
      return;
    }
    const name = username[0] === "@" ? username.slice(1) : username;

    console.time("all");
    Memory.info("start");
    await minaInit();

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
    if (name === undefined || name === null) {
      console.error("No name found", name);
      await bot.smessage("ErrordeployingNFT");
      await job.failed("No name found");
      console.timeEnd("all");
      return;
    }
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

    if (chain === "devnet") {
      const net = await await initBlockchain(chain);
      const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
      const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE_V2);
      const ownerPrivateKey = PrivateKey.random();
      const ownerPublicKey = ownerPrivateKey.toPublicKey();
      const privateKey = PrivateKey.random();
      const publicKey = privateKey.toPublicKey();
      const pinataJWT = PINATA_JWT!;

      const nft = new RollupNFT({
        name,
        address: publicKey,
        external_url: net.network.explorerAccountUrl + publicKey.toBase58(),
      });

      /*
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
      */

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
      const cache = Cache.FileSystem(cacheDir);
      await listFiles(cacheDir);

      Memory.info("before compiling");
      console.log("Compiling...");
      console.time("compiled");

      MinaNFT.setCacheFolder(cacheDir);
      if (nameVerificationKey === undefined) {
        nftVerificationKey = (await NFTContractV2.compile({ cache }))
          .verificationKey;
        if (
          nftVerificationKey.hash.toJSON() !==
          VERIFICATION_KEY_V2_JSON[chain]?.hash
        ) {
          console.error(
            "Verification key mismatch",
            nftVerificationKey.hash.toJSON(),
            VERIFICATION_KEY_V2_JSON[chain]?.hash
          );
          await bot.smessage("ErrordeployingNFT");
          await job.failed("Verification key is wrong");
          console.timeEnd("all");
          return;
        }
        nameVerificationKey = (await NameContractV2.compile({ cache }))
          .verificationKey;
        if (
          nameVerificationKey.hash.toJSON() !==
          VERIFICATION_KEY_V2_JSON[chain]?.nameHash
        ) {
          console.error(
            "Name verification key mismatch",
            nameVerificationKey.hash.toJSON(),
            VERIFICATION_KEY_V2_JSON[chain]?.nameHash
          );
          await bot.smessage("ErrordeployingNFT");
          await job.failed("Verification key is wrong");
          console.timeEnd("all");
          return;
        }
      }

      console.timeEnd("compiled");
      Memory.info("after compiling");

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

      const nameService = new MinaNFTNameServiceV2({
        address: nameServiceAddress,
        oraclePrivateKey,
      });
      const mintFee = UInt64.from(nftPrice(name).price * 1_000_000_000);

      const { signature, expiry } = await nameService.issueNameSignature({
        fee: mintFee,
        feeMaster: wallet,
        name: MinaNFT.stringToField(name),
        owner: ownerPublicKey,
        chain,
        expiryInBlocks: 100,
      });

      await sleep(2000);
      await bot.image(image, { caption: username.slice(1) });

      const uri = JSON.stringify(
        nft.toJSON({
          includePrivateData: false,
        }),
        null,
        2
      );

      const privateUri = JSON.stringify(
        nft.toJSON({
          includePrivateData: true,
        }),
        null,
        2
      );

      const deployer = await getDeployer();
      const sender = deployer.toPublicKey();
      console.log(
        `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
      );

      await nft.prepareCommitData({ pinataJWT });

      console.time("mint");
      const zkAppAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE_V2);
      const zkApp = new NameContractV2(zkAppAddress);
      const fee = Number((await MinaNFT.fee()).toBigInt());
      const memo = `mint NFT @${name}`.substring(0, 30);
      await fetchMinaAccount({ publicKey: sender });
      await fetchMinaAccount({ publicKey: zkAppAddress });
      console.time("prepared commit data");
      console.timeEnd("prepared commit data");

      if (nft.storage === undefined) throw new Error("Storage is undefined");
      if (nft.metadataRoot === undefined)
        throw new Error("Metadata is undefined");
      const json = JSON.stringify(
        nft.toJSON({
          includePrivateData: true,
        }),
        null,
        2
      );
      console.log("json", json);

      const verificationKey: VerificationKey = {
        hash: Field.fromJSON(VERIFICATION_KEY_V2_JSON.devnet.hash),
        data: VERIFICATION_KEY_V2_JSON.devnet.data,
      };
      const mintParams: MintParams = {
        name: MinaNFT.stringToField(nft.name!),
        address: publicKey,
        price: UInt64.from(BigInt(0 * 1e9)), // TODO: set price
        fee: mintFee,
        owner: ownerPublicKey,
        feeMaster: wallet,
        verificationKey,
        signature,
        metadataParams: {
          metadata: nft.metadataRoot,
          storage: nft.storage!,
        },
        expiry,
      };
      const tx = await Mina.transaction({ sender, fee, memo }, async () => {
        await zkApp.mint(mintParams);
      });

      tx.sign([privateKey, deployer]);
      await tx.prove();
      const txSent = await tx.safeSend();

      console.timeEnd("mint");
      Memory.info("mint");
      const txId = txSent?.hash;
      if (
        txSent === undefined ||
        txId === undefined ||
        txSent?.status !== "pending"
      ) {
        console.error("Error deploying NFT", txSent);
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
      await MinaNFT.transactionInfo(txSent, "mint", false);

      Memory.info("deployed");

      const privateKeyString = await encrypt(privateKey.toBase58(), name);
      if (
        privateKeyString === undefined ||
        privateKey.toBase58() !== (await decrypt(privateKeyString, name))
      ) {
        throw new Error("Error encrypting zkApp private key");
      }

      const ownerKeyString = await encrypt(ownerPrivateKey.toBase58(), name);
      if (
        ownerKeyString === undefined ||
        ownerPrivateKey.toBase58() !== (await decrypt(ownerKeyString, name))
      ) {
        throw new Error("Error encrypting owner private key");
      }

      let deployedNFT: NamesData = {
        username: name,
        chain: "devnet",
        contract: MINANFT_NAME_SERVICE_V2,
        id,
        timeCreated: Date.now(),
        storage: "i:" + nft.storage.toIpfsHash(),
        uri,
        language: language,
        privateKey: privateKeyString,
        ownerPrivateKey: ownerKeyString,
        publicKey: privateKey.toPublicKey().toBase58(),
      };

      console.log("Writing deployment to Names", deployedNFT);
      await names.create(deployedNFT);
      const algoliaData = {
        name,
        ipfs: nft.storage.toIpfsHash(),
        contractAddress: MINANFT_NAME_SERVICE_V2,
        owner: ownerPublicKey.toBase58(),
        price: "0",
        chain: chain,
        jobId: job.jobId,
      };
      await algoliaV4({
        ...algoliaData,
        status: "pending",
      });

      const metadata = new MetadataTable(METADATA_TABLE!);
      await metadata.createNewVersion({
        username: name,
        version: 1,
        uri: { username, version: 1, privateUri },
        txId,
        chain: "devnet",
        contractAddress: MINANFT_NAME_SERVICE_V2,
      });

      //await bot.invoice(username.slice(1), image);
      Memory.info("end");
      await sleep(1000);
      await job.finish(txId);
      console.timeEnd("all");
    } else {
      throw new Error("Only devnet is supported");
    }
  } catch (err) {
    console.error(err);
    await job.failed("deploy error");
    await bot.smessage("ErrordeployingNFT");
    await sleep(1000);
    console.timeEnd("all");
  }
}

/*
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
    const name = await names.getReservedName({ username });
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
    await minaInit();

    const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE_V2);
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

    const nft = new RollupNFT({
      name: username,
      address: PublicKey.fromBase58(name.publicKey),
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
      

    const nameService = new MinaNFTNameServiceV2({
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
  nameService: MinaNFTNameServiceV2;
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
  const uri = JSON.stringify(
    nft.toJSON({
      increaseVersion: true,
      includePrivateData: false,
    }),
    null,
    2
  );

  const privateUri = JSON.stringify(
    nft.toJSON({
      increaseVersion: true,
      includePrivateData: true,
    }),
    null,
    2
  );

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
  const txId = tx?.hash;
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
    chain: "devnet",
    contractAddress: MINANFT_NAME_SERVICE,
  });

  //await bot.invoice(username.slice(1), image);
  Memory.info("end");
  await sleep(1000);
  await job.finish(txId);
  console.timeEnd("all");
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
    const name = await names.getReservedName({ username });
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

  await minaInit();
  const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
  const zkNames = new MinaNFTNameServiceContract(nameServiceAddress);
  const tokenId = zkNames.deriveTokenId();
  const zkApp = new MinaNFTContract(
    PublicKey.fromBase58(json.address),
    tokenId
  );
  await fetchAccount({ publicKey: zkApp.address, tokenId });
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

*/
