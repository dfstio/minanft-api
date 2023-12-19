import { PrivateKey, PublicKey, Poseidon } from "o1js";
import {
  MinaNFT,
  MinaNFTNameService,
  MINANFT_NAME_SERVICE,
  accountBalanceMina,
  Memory,
  blockchain,
  sleep,
} from "minanft";
import nftfiles from "../mina/nftfiles.json";
import { getFileData, convertIPFSFileData } from "../storage/filedata";
import { initLanguages, getLanguage } from "../lang/lang";
import { listFiles, loadCache } from "../mina/cache";
import { algoliaWriteToken } from "../nft/algolia";
import { getDeployer } from "../mina/deployers";
import axios from "axios";

import BotMessage from "../mina/message";
import Names from "../table/names";
import NamesData from "../model/namesData";

const { PINATA_JWT, NAMES_ORACLE_SK, PROVER_KEYS_BUCKET, BLOCKCHAIN } =
  process.env;
const NAMES_TABLE = process.env.TESTWORLD2_NAMES_TABLE!;
const blockchainToDeploy: blockchain = "testworld2";

export async function mint_v3(
  id: string,
  uri: string,
  privateKey: string,
  language: string
): Promise<void> {
  Memory.info("start");
  console.log("mint_v3", id, uri, privateKey);

  try {
    const metadata = JSON.parse(uri);
    const names = new Names(NAMES_TABLE);
    const name = await names.get(metadata.name);
    if (name) {
      console.log("Found old deployment", name);
      return;
    }
    const bot = new BotMessage(id, language);

    console.time("all");

    MinaNFT.minaInit(blockchainToDeploy);
    const deployer = await getDeployer();
    const oraclePrivateKey = PrivateKey.fromBase58(NAMES_ORACLE_SK!);
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const zkAppPrivateKey =
      privateKey === ""
        ? PrivateKey.random()
        : PrivateKey.fromBase58(privateKey);
    const pinataJWT = PINATA_JWT!;

    console.log(
      `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
    );

    /*
    Memory.info("before cache");
    const nftCacheDir = "/tmp/nft-cache";
    console.time("loaded nft cache");
    await loadCache(PROVER_KEYS_BUCKET!, nftCacheDir, nftfiles);
    console.timeEnd("loaded nft cache");
    await listFiles(nftCacheDir);
    Memory.info("nft cache loaded");
    */

    const cacheDir = "/mnt/efs/cache";
    await listFiles(cacheDir);

    Memory.info("before compiling");
    console.log("Compiling...");
    MinaNFT.setCacheFolder(cacheDir);
    console.time("compiled");
    await MinaNFT.compile();
    console.timeEnd("compiled");
    Memory.info("after compiling");

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

    const nameService = new MinaNFTNameService({
      oraclePrivateKey,
      address: nameServiceAddress,
    });

    const nft = MinaNFT.fromJSON({
      metadataURI: uri,
      nameServiceAddress,
      skipCalculatingMetadataRoot: true,
    });

    console.time("mint");
    const tx = await nft.mint(
      {
        nameService,
        deployer,
        pinataJWT,
        privateKey: zkAppPrivateKey,
      },
      true
    );
    console.timeEnd("mint");

    Memory.info("mint");
    if (tx === undefined) {
      console.error("Error deploying NFT");
      await bot.tmessage("ErrordeployingNFT");
      Memory.info("deploy error");
      console.timeEnd("all");
      return;
    }
    Memory.info("deployed");

    await bot.tmessage("sucessDeploymentMessage", {
      nftname: nft.name,
      hash: tx.hash(),
    });
    await MinaNFT.transactionInfo(tx, "mint", false);

    await bot.invoice(nft.name.slice(1), image);

    const deployData = {
      privateKey: zkAppPrivateKey.toBase58(),
      publicKey: zkAppPrivateKey.toPublicKey().toBase58(),
      //ownerPrivateKey: ownerPrivateKey.toBase58(),
      storage: nft.storage,
      telegramId: id,
    };
    const creator: string =
      metadata.creator == "" || metadata.creator === undefined
        ? "@MinaNFT_bot"
        : metadata.creator[0] === "@"
        ? metadata.creator
        : "@" + metadata.creator;
    let deployedNFT: NamesData = {
      username: nft.name,
      id,
      timeCreated: Date.now(),
      uri: metadata,
      creator,
      language: language,
      ipfs: nft.storage.slice(2),
    };
    const newURI = nft.toJSON() as any;
    const properties: string = JSON.stringify(newURI.properties);
    newURI.properties = properties;
    deployedNFT.testworld2 = deployData;
    deployedNFT.testworld2uri = newURI;
    console.log("Writing deployment to Names", deployedNFT);
    await names.create(deployedNFT);
    await algoliaWriteToken(deployedNFT);
    Memory.info("end");
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
