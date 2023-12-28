import { PrivateKey, PublicKey, Signature, Field, Mina } from "o1js";
import Jobs from "../table/jobs";
import {
  MinaNFT,
  MinaNFTNameService,
  MINANFT_NAME_SERVICE,
  VERIFICATION_KEY_HASH,
  accountBalanceMina,
  Memory,
  blockchain,
  sleep,
  MinaNFTCommitData,
  Update,
} from "minanft";
import { listFiles } from "../mina/cache";
import { algoliaWriteToken } from "../nft/algolia";
import { getDeployer } from "../mina/deployers";
import axios from "axios";

import BotMessage from "../mina/message";
import Names from "../table/names";
import { NamesData } from "../model/namesData";
import { isReservedName } from "../nft/reservednames";
import { nftPrice } from "../payments/pricing";
import { use } from "i18next";
import { ARWEAVE_KEY_STRING } from "../mina/gastanks";
import { encrypt, decrypt } from "../nft/kms";

const { PINATA_JWT, NAMES_ORACLE_SK, PROVER_KEYS_BUCKET, BLOCKCHAIN } =
  process.env;
const NAMES_TABLE = process.env.TESTWORLD2_NAMES_TABLE!;
const blockchainToDeploy: blockchain = "testworld2";

export async function reserveName(
  id: string,
  name: string,
  publicKey: string,
  language: string
): Promise<{
  success: boolean;
  signature: string;
  price?: string;
  reason: string;
}> {
  if (name === "" || name === "@")
    return { success: false, signature: "", reason: "empty name" };
  const nftName = name[0] === "@" ? name : "@" + name;
  if (nftName.length > 30)
    return { success: false, signature: "", reason: "name too long" };
  if (isReservedName(name))
    return { success: false, signature: "", reason: "reserved name" };

  try {
    const names = new Names(NAMES_TABLE);
    const checkName = await names.get({ username: nftName });
    if (checkName !== undefined) {
      console.log("Found old deployment", checkName);
      if (checkName.id !== id) {
        return {
          success: false,
          signature: "",
          reason: "Already deployed by another user",
        };
      }
    }
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
      publicKey,
      signature: signature.toBase58(),
      username: nftName,
      language,
      timeCreated: Date.now(),
    };
    await names.create(nft);

    return {
      success: true,
      signature: signature.toBase58(),
      price: JSON.stringify(nftPrice(name)),
      reason: "",
    };
  } catch (err) {
    console.error(err);
    return { success: false, signature: "", reason: "error" };
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
    const names = new Names(NAMES_TABLE);
    const nftData = await names.get({ username: nftName });
    if (nftData === undefined || nftData.publicKey === undefined) {
      console.log("No deployment");
      return {
        success: false,
        reason: "Not found",
      };
    }

    const nameService = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const address = PublicKey.fromBase58(nftData.publicKey);
    MinaNFT.minaInit(blockchainToDeploy);
    const nft = new MinaNFT({
      name: nftName,
      address,
      nameService,
    });
    await nft.loadMetadata();

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
  } catch (err) {
    console.error(err);
    return { success: false, reason: "error" };
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

  try {
    const JobsTable = new Jobs(process.env.JOBS_TABLE!);
    await JobsTable.updateStatus({
      username: id,
      jobId: jobId,
      status: "started",
    });
    const bot = new BotMessage(id, language);

    const metadata = JSON.parse(uri);
    const names = new Names(NAMES_TABLE);
    const name = await names.get({ username: metadata.name });
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

    MinaNFT.minaInit(blockchainToDeploy);
    const deployer = await getDeployer();

    const pinataJWT: string = PINATA_JWT!;
    const arweaveKey: string = ARWEAVE_KEY_STRING!;

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
    const hash: string | undefined = tx.hash();
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

  try {
    const JobsTable = new Jobs(process.env.JOBS_TABLE!);
    await JobsTable.updateStatus({
      username: id,
      jobId: jobId,
      status: "started",
    });
    const bot = new BotMessage(id, language);
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

    MinaNFT.minaInit(blockchainToDeploy);
    const deployer = await getDeployer();

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
    const hash: string | undefined = tx.hash();
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
    const storage = MinaNFT.stringFromFields(update.storage.toFields());
    const url = MinaNFT.urlFromStorageString(storage);
    console.log("post storage:", storage, url);
    const uri = (await axios.get(url)).data;
    console.log("post uri:", uri);
    const names = new Names(NAMES_TABLE);
    await names.updateStorage(nftName, storage, JSON.stringify(uri, null, 2));
    await bot.tmessage("sucessDeploymentMessage", {
      nftname: nftName + " : " + postName,
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
  }
}

/*
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPrivateKeyString = PrivateKey.toBase58(zkAppPrivateKey);
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    const zkAppAddressString = PublicKey.toBase58(zkAppPublicKey);
    const secret = Field.random();
    //  "createdNFTaccount": "NFT deployment (1/3): created NFT account {{account}}"
    await bot.tmessage("createdNFTaccount", { account: zkAppAddressString });
    

    let result = <DeployData>{
      privateKey: zkAppPrivateKeyString,
      publicKey: zkAppAddressString,
      explorer: `${MINAEXPLORER}${zkAppAddressString}`,
      telegramId: id,
      secret: Field.toJSON(secret),
    };
    console.log("NFT deployment (1/3): created NFT account", result);
    

    let cidImage: string | undefined;
    if (!nft.ipfs || nft.ipfs === "") {
      const ipfs = new IPFS(PINATA_JWT!);
      cidImage = await ipfs.addLink(nft.uri.image);
      if (cidImage) cidImage = "https://ipfs.io/ipfs/" + cidImage;
    } else cidImage = nft.uri.image;
    console.log("cidImage", cidImage);
    if (!cidImage || cidImage === "") {
      console.error("deployContract - addLink error");
      //    "IPFSerrorimage": "NFT deployment: IPFS error. Cannot upload image. Please try again later by typing command \"new\""
      await bot.tmessage("IPFSerrorimage");
      return;
    }
    

    let deployedNFT: NamesData = nft;
    deployedNFT.deploy = result;
    deployedNFT.uri.image = cidImage;
    deployedNFT.uri.minaPublicKey = zkAppAddressString;
    deployedNFT.uri.minaExplorer = `${MINAEXPLORER}${zkAppAddressString}`;

    let cidURI: string | undefined;
    if (!nft.ipfs || nft.ipfs === "") {
      const ipfs = new IPFS(PINATA_JWT);
      cidURI = await ipfs.add(deployedNFT.uri);
    } else cidURI = nft.ipfs;
    console.log("cidURI", cidURI);
    if (!cidURI) {
      console.error("deployContract - add error");
      //  "IPFSerroruri": "NFT deployment: IPFS error. Cannot upload URI. Please try again later by typing command \"new\""
      await bot.tmessage("IPFSerroruri");
      return;
    }
    deployedNFT.ipfs = cidURI;

   

    const deployerPrivateKey = await getDeployer();
    const deployerPublicKey = deployerPrivateKey.toPublicKey();

    let zkApp = new AvatarNFT(zkAppPublicKey);

    const startTime = Date.now();
    // compile the contract to create prover keys
    console.log("Compiling NFT smart contract...");

    let { verificationKey } = await AvatarNFT.compile();
    const compileTime = Date.now();
    const delay = formatWinstonTime(compileTime - startTime);
    console.log("Compilation took", delay);

    const hash: string | undefined = await deploy(
      deployerPrivateKey,
      zkAppPrivateKey,
      zkApp,
      verificationKey,
      bot
    );
    if (!hash || hash == "") {
      console.error("Error deploying contract");
      //  "Errordeployingcontract": "NFT deployment: Error deploying contract to MINA blockchain. Please try again later by typing command \"new\""
      await bot.tmessage("Errordeployingcontract");
      return;
    }

    const table = new Tasks(TASKS_TABLE);
    const MIN_IN_MS = 60 * 1000;
    const task: TasksData = {
      id,
      task: "create",
      startTime: Date.now() + MIN_IN_MS,
      taskdata: deployedNFT,
    };
    await table.update(task);
    await sleep(1000);
      */

/*
async function createNFT(id: string, nft: NamesData): Promise<void> {
  console.log("createNFT", id, nft);
  const bot = new BotMessage(id, nft.language);
  if (!nft.deploy || !nft.ipfs || !nft.deploy.secret) {
    console.error("No nft.deploy or nft.ipfs or deploy.secret");
    //   "ErrordeployingNFT": "NFT deployment: Error deploying NFT to MINA blockchain. Please try again later by typing command \"new\""
    await bot.tmessage("ErrordeployingNFT");
    return;
  }
  axios
    .get(
      `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${nft.uri.image}`,
      {
        responseType: "arraybuffer",
      }
    )
    .then((response: any) => {
      console.log("cloudinary ping");
    })
    .catch((e: any) => console.error("cloudinary ping", e));
  await minaInit();
  const address = PublicKey.fromBase58(nft.deploy.publicKey);
  let check = await Mina.hasAccount(address);
  console.log("check1", check);
  if (!check) {
    await fetchAccount({ publicKey: address });
    check = await Mina.hasAccount(address);
    console.log("check2", check);
    if (!check) return;
  }

  let zkApp = new AvatarNFT(PublicKey.fromBase58(nft.deploy.publicKey));

  const startTime = Date.now();
  // compile the contract to create prover keys
  console.log("Compiling smart contract...");

  let { verificationKey } = await AvatarNFT.compile();
  const compileTime = Date.now();
  const delay = formatWinstonTime(compileTime - startTime);
  console.log("Compilation took", delay);
  console.log("Creating tx...");
  const deployerPrivateKey = await getDeployer();
  const deployerPublicKey = deployerPrivateKey.toPublicKey();
  await fetchAccount({ publicKey: deployerPublicKey });

  let sender = deployerPrivateKey.toPublicKey();
  const ipfsFields: Field[] | undefined = ipfsToFields("ipfs:" + nft.ipfs);
  if (!ipfsFields) {
    console.error("Error converting IPFS hash");
    //   "ErrorconvertingIPFShash": "NFT deployment: Error converting IPFS hash of the NFT. Please try again later by typing command \"new\""
    await bot.tmessage("ErrorconvertingIPFShash");
    return;
  }
  let newsecret: Field;
  if (nft.deploy && nft.deploy.secret)
    newsecret = Field.fromJSON(nft.deploy.secret);
  else {
    console.error("No secret in nft.deploy.secret");
    //   "Cannotsetnewpasssword":  "NFT deployment: Error deploying NFT to MINA blockchain. Cannot set new passsword for the NFT. Please try again later by typing command \"new\""
    await bot.tmessage("Cannotsetnewpasssword");
    return;
  }


  const map: MerkleMap = new MerkleMap();
  const root: Field = map.getRoot(); // TODO: calculate real roots for all data structures

  const tx = await Mina.transaction(
    {
      sender,
      fee: 0.1e9,
      memo: "@minanft_bot",
    },
    () => {
      zkApp.createNFT(
        Encoding.stringToFields(nft.username)[0], //username:
        root,
        root,
        root,
        root,
        ipfsFields[0], //uri1:
        ipfsFields[1], //uri2:
        Field.fromJSON(process.env.NFT_SALT!), //TODO: change to random salt
        Field.fromJSON(process.env.NFT_SECRET!) //TODO: change to random secret
      );
    }
  );

  const startTime1 = Date.now();
  await tx.prove();
  const endTime = Date.now();
  const delay3 = formatWinstonTime(endTime - startTime1);
  console.log("Proof took", delay3, ", now sending transaction...");
  tx.sign([deployerPrivateKey]);

  let sentTx = await tx.send();

  if (sentTx.hash() !== undefined) {
    await algoliaWriteToken(nft);
    const successMsg = `Success! NFT deployment (3/3): NFT ${
      nft.uri.name
    } is written to MINA blockchain: 
https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}

You can see it at https://minanft.io/${nft.username}
If you want to create one more NFT, type command "new"`;
    console.log(successMsg);

    const table = new Tasks(TASKS_TABLE);
    await table.remove(id);
    await sleep(1000);
    //   "sucessDeploymentMessage": "Success! NFT deployment (3/3): NFT {{nftname}}\nis written to the MINA blockchain:\nhttps://berkeley.minaexplorer.com/transaction/{{hash}}\n\nYou can see it at https://minanft.io/{{nftname}}\nIf you want to create one more NFT, type command \"new\""
    await bot.tmessage("sucessDeploymentMessage", {
      nftname: nft.username,
      hash: sentTx.hash(),
    });
  } else {
    console.error("Send fail", sentTx);
    //   "Transactionhasfailed": "Transaction has failed"
    await bot.tmessage("Transactionhasfailed");
  }
  await sleep(1000);
  return;
}

*/
