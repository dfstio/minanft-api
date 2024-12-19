import { PrivateKey, PublicKey, Signature, Field, Mina, UInt64 } from "o1js";
import Jobs from "../table/jobs";
import {
  MinaNFT,
  MinaNFTNameService,
  MinaNFTNameServiceV2,
  MINANFT_NAME_SERVICE,
  MINANFT_NAME_SERVICE_V2,
  KYCSignatureData,
  MintSignatureData,
  VERIFICATION_KEY_HASH,
  accountBalanceMina,
  Memory,
  sleep,
  MinaNFTCommitData,
  Update,
  Storage,
  wallet,
  initBlockchain,
} from "minanft";
import { listFiles } from "../mina/cache";
import { algoliaWriteToken } from "../nft/algolia";
import { algoliaIsExist } from "../nft/algoliav4";
import { getDeployer } from "../mina/deployers";
import axios from "axios";

import BotMessage from "../chatgpt/message";
import Names from "../table/names";
import Users from "../table/users";
import { NamesData } from "../model/namesData";
import { isReservedName } from "../nft/reservednames";
import { nftPrice } from "../payments/pricing";
import { ARWEAVE_KEY_STRING } from "../mina/gastanks";
import { encrypt, decrypt } from "../nft/kms";
import { explorerTransaction, minaInit } from "../mina/init";
import { LIST, DEVELOPERS, KEYS, getPrice } from "../mina/list";

const { PINATA_JWT, NAMES_ORACLE_SK } = process.env;
const NAMES_TABLE = process.env.NAMES_TABLE!;

export async function reserveName(
  id: string,
  args: string,
  language: string
): Promise<{
  success: boolean;
  signature: string;
  expiry?: string;
  price?: string;
  reason: string;
}> {
  try {
    const { name, publicKey, chain, contract, version, developer, repo, key } =
      JSON.parse(args);
    if (LIST.includes(publicKey)) {
      console.error("reserveName ERR3817", { publicKey, name, chain });
      return { success: false, signature: "", reason: "ERR3817" };
    }
    if (name === "" || name === "@")
      return { success: false, signature: "", reason: "empty name" };
    const nftName = name[0] === "@" ? name : "@" + name;
    if (nftName.length > 30)
      return { success: false, signature: "", reason: "name too long" };
    if (isReservedName(name))
      return { success: false, signature: "", reason: "reserved name" };
    await initBlockchain(chain);

    const names = new Names(NAMES_TABLE);
    const checkName = await names.getReservedName({ username: nftName });
    if (checkName !== undefined) {
      console.log("Found old deployment", { checkName, id, publicKey });
      if (
        (checkName.id !== id || checkName.publicKey !== publicKey) &&
        (checkName.chain === "mainnet" || chain !== "mainnet")
      ) {
        // TODO: analyze signatureExpiry
        if (KEYS[0] === key || KEYS[1] === key) {
          const isExist = await algoliaIsExist({
            name,
            contractAddress: MINANFT_NAME_SERVICE_V2,
            chain,
          });
          if (isExist) {
            return {
              success: false,
              signature: "",
              reason: "NFT already used by another user",
            };
          } else if (checkName.timeCreated + 1000 * 60 * 10 > Date.now()) {
            console.error(
              "NFT is being minted by another user, passed",
              (Date.now() - checkName.timeCreated) / 1000 / 60,
              "min:",
              checkName
            );
            return {
              success: false,
              signature: "",
              reason: "NFT is being minted by another user",
            };
          } else {
            console.error(
              "Reusing the NFT name after",
              (Date.now() - checkName.timeCreated) / 1000 / 60,
              "min:",
              checkName
            );
          }
        } else {
          return {
            success: false,
            signature: "",
            reason: "Already used by another user",
          };
        }
      }
    }

    if (version === "v2") {
      const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
      const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE_V2);
      //const verificationKeyHash = Field.fromJSON(VERIFICATION_KEY_HASH_V2);
      const owner = PublicKey.fromBase58(publicKey);
      const nameService = new MinaNFTNameServiceV2({
        address: nameServiceAddress,
        oraclePrivateKey,
      });
      let nftPriceData = nftPrice(name);
      let fee = UInt64.from(nftPriceData.price * 1_000_000_000);
      let feeMaster = wallet;
      /*
      if (
        DEVELOPERS.includes(publicKey) ||
        (key !== undefined && KEYS.includes(key))
      ) {
        fee = UInt64.from(1_000_000_000);
      }
      */

      if (KEYS[0] === key || KEYS[1] === key) {
        const price = await getPrice(name);
        if (price !== undefined) {
          console.error("Price 0 found", { chain, name, price });
          feeMaster = PublicKey.fromBase58(
            KEYS[1] === key ? DEVELOPERS[1] : DEVELOPERS[0]
          );
          nftPriceData.price = price;
          fee = UInt64.from(price * 1_000_000_000);
        } else {
          console.error("Price 0 not found", { chain, name, price });
          return {
            success: false,
            signature: "",
            reason: "error 0",
          };
        }
      }

      const { signature, expiry } = await nameService.issueNameSignature({
        fee,
        feeMaster,
        name: MinaNFT.stringToField(name),
        owner,
        chain,
        expiryInBlocks: 100,
      });
      if (expiry === undefined || signature === undefined) {
        return {
          success: false,
          signature: "",
          reason: "error",
        };
      }
      console.log("Signature", signature.toBase58(), expiry.toBigint());

      const nft: NamesData = {
        id,
        chain,
        contract,
        publicKey,
        signature: signature.toBase58(),
        signatureExpiry: expiry.toBigint().toString(),
        username: nftName,
        language,
        timeCreated: Date.now(),
        version,
        developer,
        repo,
      };
      await names.create(nft);

      return {
        success: true,
        signature: signature.toBase58(),
        expiry: expiry.toBigint().toString(),
        price: JSON.stringify(nftPriceData),
        reason: "",
      };
    } else {
      const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
      const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
      const verificationKeyHash = Field.fromJSON(VERIFICATION_KEY_HASH);
      const address = PublicKey.fromBase58(publicKey);

      const signature: Signature = Signature.create(oraclePrivateKey, [
        ...address.toFields(),
        MinaNFT.stringToField(nftName),
        verificationKeyHash,
        ...nameServiceAddress.toFields(),
      ]);

      const nft: NamesData = {
        id,
        chain,
        contract,
        publicKey,
        signature: signature.toBase58(),
        username: nftName,
        language,
        timeCreated: Date.now(),
        version: "v1",
      };
      await names.create(nft);

      return {
        success: true,
        signature: signature.toBase58(),
        price: JSON.stringify(nftPrice(name)),
        reason: "",
      };
    }
  } catch (err: any) {
    console.error(err);
    return {
      success: false,
      signature: "",
      reason: (err?.toString ? err?.toString() : undefined) ?? "error",
    };
  }
}

export async function indexName(
  id: string,
  name: string,
  language: string
): Promise<{
  success: boolean;
  reason: string;
}> {
  if (name === "" || name === "@")
    return { success: false, reason: "empty name" };
  const nftName = name[0] === "@" ? name : "@" + name;
  if (nftName.length > 30) return { success: false, reason: "name too long" };

  try {
    await minaInit();
    const names = new Names(NAMES_TABLE);
    const nftData = await names.getReservedName({ username: nftName });
    if (nftData === undefined || nftData.publicKey === undefined) {
      console.log("No deployment");
      return {
        success: false,
        reason: "Not found",
      };
    }

    const nameService = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const address = PublicKey.fromBase58(nftData.publicKey);

    console.log("Loading metadata for", nftName, nftData.publicKey);
    const nft = new MinaNFT({
      name: nftName,
      address,
      nameService,
    });
    await nft.loadMetadata(undefined, true);

    let deployedNFT: NamesData = nftData;
    deployedNFT.uri = JSON.stringify(nft.toJSON());
    deployedNFT.storage = nft.storage;
    console.log("Writing deployment to Names", deployedNFT);
    await names.create(deployedNFT);
    await algoliaWriteToken(deployedNFT);

    return {
      success: true,
      reason: "",
    };
  } catch (err: any) {
    console.error(err);
    return { success: false, reason: `error: ${err.toString()}` };
  }
}

export async function mint_v3(
  id: string,
  jobId: string,
  uri: string,
  signature: string,
  privateKey: string,
  useArweave: string,
  language: string
): Promise<void> {
  const timeStarted = Date.now();
  console.time("all");
  Memory.info("start");
  console.log("mint_v3", id, uri, signature, privateKey, language);
  const JobsTable = new Jobs(process.env.JOBS_TABLE!);
  const bot = new BotMessage(id, language);

  try {
    await JobsTable.updateStatus({
      username: id,
      jobId: jobId,
      status: "started",
    });

    console.log("uri", uri);
    if (typeof uri !== "string" && typeof uri !== "object") {
      throw new Error("Invalid uri");
    }
    const metadata = typeof uri === "string" ? JSON.parse(uri) : uri;
    const names = new Names(NAMES_TABLE);
    const name = await names.getReservedName({ username: metadata.name });
    if (name) {
      console.log("Found name record", name);
    }

    const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
    const oraclePublicKey = oraclePrivateKey.toPublicKey();
    const zkAppPrivateKey = PrivateKey.fromBase58(privateKey);
    const address = zkAppPrivateKey.toPublicKey();
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const verificationKeyHash = Field.fromJSON(VERIFICATION_KEY_HASH);

    const nameService = new MinaNFTNameService({
      oraclePrivateKey,
      address: nameServiceAddress,
    });

    const nft = MinaNFT.fromJSON({
      metadataURI: uri,
      nameServiceAddress,
      skipCalculatingMetadataRoot: true,
    });

    const msg: Field[] = [
      ...address.toFields(),
      MinaNFT.stringToField(nft.name),
      verificationKeyHash,
      ...nameServiceAddress.toFields(),
    ];
    const checkSignature: boolean = Signature.fromBase58(signature)
      .verify(oraclePublicKey, msg)
      .toBoolean();

    let isError = false;
    if (name !== undefined && name.id !== id) {
      console.error("Found old deployment by another user", name);
      isError = true;
    }

    if (!checkSignature) {
      console.error("Signature is wrong");
      isError = true;
    }

    if (isError) {
      await bot.tmessage("ErrordeployingNFT");
      await JobsTable.updateStatus({
        username: id,
        jobId: jobId,
        status: "failed",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info("deploy error");
      console.timeEnd("all");
      return;
    }

    await minaInit();

    const pinataJWT: string = PINATA_JWT!;
    const arweaveKey: string = ARWEAVE_KEY_STRING!;

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
      await bot.tmessage("ErrordeployingNFT");
      await JobsTable.updateStatus({
        username: id,
        jobId: jobId,
        status: "failed",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info("deploy error");
      console.timeEnd("all");
      return;
    }

    const image = `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${metadata.image}`;
    console.log("image", image);
    axios
      .get(image, {
        responseType: "arraybuffer",
      })
      .then((response: any) => {
        console.log("cloudinary ping - aws");
      })
      .catch((e: any) => console.error("cloudinary ping - aws error"));

    const deployer = await getDeployer();
    console.log(
      `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
    );
    console.time("mint");
    const tx = await nft.mint(
      {
        nameService,
        deployer,
        pinataJWT: useArweave === "true" ? undefined : pinataJWT,
        arweaveKey: useArweave === "true" ? arweaveKey : undefined,
        privateKey: zkAppPrivateKey,
      },
      true
    );
    console.timeEnd("mint");

    Memory.info("mint");
    if (tx === undefined) {
      console.error("Error deploying NFT");
      await bot.tmessage("ErrordeployingNFT");
      await JobsTable.updateStatus({
        username: id,
        jobId: jobId,
        status: "failed",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info("deploy error");
      console.timeEnd("all");
      return;
    }
    Memory.info("deployed");
    const hash: string | undefined = tx.hash;
    if (hash === undefined) {
      console.error("Error deploying NFT");
      await bot.tmessage("ErrordeployingNFT");
      await JobsTable.updateStatus({
        username: id,
        jobId: jobId,
        status: "failed",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info("deploy error");
      console.timeEnd("all");
      return;
    }

    await bot.tmessage("sucessDeploymentMessage", {
      nftname: nft.name,
      explorer: explorerTransaction(),
      hash,
    });
    await MinaNFT.transactionInfo(tx, "mint", false);

    // TODO: Enable invoices after the New Year
    //await bot.invoice(nft.name.slice(1), image);

    const creator: string =
      metadata.creator == "" || metadata.creator === undefined
        ? "@MinaNFT_bot"
        : metadata.creator[0] === "@"
        ? metadata.creator
        : "@" + metadata.creator;

    const privateKeyString = await encrypt(
      zkAppPrivateKey.toBase58(),
      nft.name
    );
    if (
      privateKeyString === undefined ||
      zkAppPrivateKey.toBase58() !== (await decrypt(privateKeyString, nft.name))
    ) {
      throw new Error("Error encrypting private key");
    }

    let deployedNFT: NamesData = {
      username: nft.name,
      chain: "devnet",
      contract: MINANFT_NAME_SERVICE,
      id,
      timeCreated: Date.now(),
      storage: nft.storage,
      uri,
      creator,
      language: language,
      privateKey: privateKeyString,
      publicKey: zkAppPrivateKey.toPublicKey().toBase58(),
    };

    console.log("Writing deployment to Names", deployedNFT);
    await names.create(deployedNFT);
    await algoliaWriteToken(deployedNFT);
    const users = new Users(process.env.DYNAMODB_TABLE!);
    await users.updateAllowedUsage(id);
    Memory.info("end");
    await JobsTable.updateStatus({
      username: id,
      jobId: jobId,
      status: "finished",
      result: hash,
      billedDuration: Date.now() - timeStarted,
    });

    await sleep(1000);
    console.timeEnd("all");
  } catch (err) {
    console.error(err);
    console.error("Error deploying NFT");
    await bot.tmessage("ErrordeployingNFT");
    await JobsTable.updateStatus({
      username: id,
      jobId: jobId,
      status: "failed",
      billedDuration: Date.now() - timeStarted,
    });
    Memory.info("deploy error");
    console.timeEnd("all");
  }
}

export async function post_v3(
  id: string,
  jobId: string,
  transactions: string[],
  args: string[],
  language: string
): Promise<void> {
  const timeStarted = Date.now();
  console.time("all");
  Memory.info("start");
  console.log("post_v3", id, language);
  if (args.length !== 6) {
    console.error("Wrong args length", args.length);
    return;
  }

  const JobsTable = new Jobs(process.env.JOBS_TABLE!);
  const bot = new BotMessage(id, language);

  try {
    await JobsTable.updateStatus({
      username: id,
      jobId: jobId,
      status: "started",
    });

    const commitData: MinaNFTCommitData = {
      transactions: transactions,
      signature: args[0],
      address: args[1],
      update: args[2],
    };
    const ownerPublicKey = args[3];
    const nftName = args[4];
    const postName = args[5];

    /*
    const metadata = JSON.parse(uri);
    const names = new Names(NAMES_TABLE);
    const name = await names.get(metadata.name);
    if (name) {
      console.log("Found name record", name);
    }
    */

    const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
    const oraclePublicKey = oraclePrivateKey.toPublicKey();
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const verificationKeyHash = Field.fromJSON(VERIFICATION_KEY_HASH);

    const nameService = new MinaNFTNameService({
      oraclePrivateKey,
      address: nameServiceAddress,
    });

    await minaInit();

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
      await bot.tmessage("ErrordeployingNFT");
      await JobsTable.updateStatus({
        username: id,
        jobId: jobId,
        status: "failed",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info("deploy error");
      console.timeEnd("all");
      return;
    }

    const deployer = await getDeployer();
    console.log(
      `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
    );
    console.time("post");
    const tx = await MinaNFT.commitPreparedData({
      nameService,
      deployer,
      preparedCommitData: commitData,
      ownerPublicKey,
    });
    console.timeEnd("post");

    Memory.info("post commited");
    if (tx === undefined) {
      console.error("Error deploying NFT");
      await bot.tmessage("ErrordeployingNFT");
      await JobsTable.updateStatus({
        username: id,
        jobId: jobId,
        status: "failed",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info("deploy error");
      console.timeEnd("all");
      return;
    }
    Memory.info("deployed");
    const hash: string | undefined = tx.hash;
    if (hash === undefined) {
      console.error("Error deploying NFT");
      await bot.tmessage("ErrordeployingNFT");
      await JobsTable.updateStatus({
        username: id,
        jobId: jobId,
        status: "failed",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info("deploy error");
      console.timeEnd("all");
      return;
    }

    await MinaNFT.transactionInfo(tx, "post", false);

    const update = Update.fromFields(
      JSON.parse(commitData.update).update.map((f: string) => Field.fromJSON(f))
    );
    const storage = MinaNFT.stringFromFields(Storage.toFields(update.storage));
    const url = MinaNFT.urlFromStorageString(storage);
    console.log("post storage:", storage, url);
    const uri = (await axios.get(url)).data;
    console.log("post uri:", uri);
    const names = new Names(NAMES_TABLE);
    await names.updateStorage(nftName, storage, JSON.stringify(uri, null, 2));
    await bot.tmessage("sucessDeploymentMessage", {
      nftname: nftName + " : " + postName,
      explorer: explorerTransaction(),
      hash,
    });
    // TODO: Enable invoices after the New Year
    //await bot.invoice(nft.name.slice(1), image);
    await sleep(1000);
    const deployedNFT = await names.get({ username: nftName });
    if (deployedNFT === undefined) {
      console.error("Error getting deployed NFT");
      await bot.tmessage("ErrordeployingNFT");
      await JobsTable.updateStatus({
        username: id,
        jobId: jobId,
        status: "failed",
        billedDuration: Date.now() - timeStarted,
      });
      Memory.info("deploy error");
      console.timeEnd("all");
      return;
    }
    await algoliaWriteToken(deployedNFT);

    Memory.info("end");
    await JobsTable.updateStatus({
      username: id,
      jobId: jobId,
      status: "finished",
      result: hash,
      billedDuration: Date.now() - timeStarted,
    });

    await sleep(1000);
    console.timeEnd("all");
  } catch (err) {
    console.error(err);
    console.error("Error deploying NFT");
    await bot.tmessage("ErrordeployingNFT");
    await JobsTable.updateStatus({
      username: id,
      jobId: jobId,
      status: "failed",
      billedDuration: Date.now() - timeStarted,
    });
    Memory.info("deploy error");
    console.timeEnd("all");
  }
}
