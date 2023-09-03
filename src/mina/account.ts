import {
  Mina,
  PrivateKey,
  PublicKey,
  Field,
  AccountUpdate,
  isReady,
  fetchAccount,
  shutdown,
  Encoding,
  UInt64,
  MerkleMap,
} from "snarkyjs";
import axios from "axios";

import BotMessage from "./message";
import callLambda from "./lambda";
import TasksData from "../model/tasksData";
import Tasks from "../connector/tasks";
import Names from "../connector/names";
import { AvatarNFT } from "./avatarnft";
import DynamoDbConnector from "../connector/dynamoDbConnector";
import AccountData from "../model/accountData";
import DeployData from "../model/deployData";
import NamesData from "../model/namesData";
import FormQuestion from "../model/formQuestion";
import Questions from "../questions";
import IPFS from "../nft/ipfs";

/* gastanks.ts - private keys of gas tanks
	export const GASTANKS : string[] = [
			 "EKE...",
			 "EKE...",
			 ...
			];

*/
import { GASTANKS } from "./gastanks"; //
import { algoliaWriteToken } from "../nft/algolia";
import { ipfsToFields, fieldsToIPFS } from "./conversions";

const MINAURL = process.env.MINAURL
  ? process.env.MINAURL
  : "https://proxy.berkeley.minaexplorer.com/graphql";
const MINAEXPLORER = process.env.MINAEXPLORER
  ? process.env.MINAEXPLORER
  : "https://berkeley.minaexplorer.com/wallet/";

const PRIVATEKEY = process.env.PRIVATEKEY!;
const FEE = 0.1e9;
const GASTANK_MINLIMIT = 5;
const TASKS_TABLE = process.env.TASKS_TABLE!;
const NAMES_TABLE = process.env.NAMES_TABLE!;
const PINATA_JWT = process.env.PINATA_JWT!;

async function generateAccount(
  id: string,
  gastank: string = "",
): Promise<void> {
  console.log("generateAccount", id);

  const zkAppPrivateKey = PrivateKey.random();
  const zkAppPrivateKeyString = PrivateKey.toBase58(zkAppPrivateKey);
  const zkAppAddress = zkAppPrivateKey.toPublicKey();
  const zkAppAddressString = PublicKey.toBase58(zkAppAddress);
  const salt = Field.random();

  let result = <AccountData>{
    privateKey: zkAppPrivateKeyString,
    publicKey: zkAppAddressString,
    explorer: `${MINAEXPLORER}${zkAppAddressString}`,
    salt: salt.toJSON(),
  };
  console.log("Created account", result);

  await topupAccount(result.publicKey);
  const table = new Tasks(TASKS_TABLE);
  const MIN_IN_MS = 60 * 1000;
  const task: TasksData = {
    id,
    task: "topup",
    startTime: Date.now() + MIN_IN_MS,
    taskdata: { account: result, gastank },
  };
  await table.create(task);
}

async function checkBalance(
  id: string,
  data: AccountData,
  gastank: string,
): Promise<void> {
  console.log("Checking balance...", id, data);
  if (!data || !gastank || gastank == "") {
    console.error("Wrong topup data");
    return;
  }

  await minaInit();
  const accountPrivateKeyMina = PrivateKey.fromBase58(data.privateKey);
  const accountPublicKeyMina = accountPrivateKeyMina.toPublicKey();
  const gasTankPrivateKeyMina = PrivateKey.fromBase58(gastank);
  const gasTankPublicKeyMina = gasTankPrivateKeyMina.toPublicKey();
  const balanceAccount = await accountBalance(accountPublicKeyMina);
  const balanceAccountMina = Number(balanceAccount.toBigInt()) / 1e9;
  console.log("Balance of account", balanceAccountMina.toLocaleString("en"));

  if (balanceAccount.toBigInt() > Number(FEE)) {
    console.log("Creating tx...");
    const fee: UInt64 = UInt64.from(FEE);
    const amount: UInt64 = balanceAccount.sub(fee);
    const tx = await Mina.transaction(
      { sender: accountPublicKeyMina, fee },
      () => {
        let senderUpdate = AccountUpdate.create(accountPublicKeyMina);
        senderUpdate.requireSignature();
        senderUpdate.send({ to: gasTankPublicKeyMina, amount });
      },
    );

    tx.sign([accountPrivateKeyMina]);
    let sentTx = await tx.send();

    const table = new Tasks(TASKS_TABLE);
    await table.remove("topup"); //TODO for specific gastank

    if (sentTx.hash() !== undefined) {
      console.log(`
Success! Topup transaction sent:
https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
	`);
    } else console.error("Send topup fail", sentTx);
  }

  /*
    //Start deployment
    const deployer = <DeployData>{
      privateKey: result.privateKey,
      publicKey: result.publicKey,
      explorer: result.explorer,
      salt: result.salt,
      telegramId: id,
      hash: "",
    };

    console.log("Start deployment", deployer);
    await callLambda("deploy", JSON.stringify(deployer));
    await sleep(1000);
  }
*/
}

async function checkGasTank(gastank: string): Promise<boolean> {
  const gasTankPrivateKeyMina = PrivateKey.fromBase58(gastank);
  const gasTankPublicKeyMina = gasTankPrivateKeyMina.toPublicKey();

  const balanceGasTank = await accountBalance(gasTankPublicKeyMina);
  const balanceGasTankMina = Number(balanceGasTank.toBigInt()) / 1e9;
  const replenishGasTank: boolean = balanceGasTankMina < GASTANK_MINLIMIT;
  console.log(
    "Balance of gas tank",
    balanceGasTankMina.toLocaleString("en"),
    ", needs replenishing:",
    replenishGasTank,
  );

  return replenishGasTank;
  /*
    if (replenishGasTank) {
        const table = new Tasks(TASKS_TABLE);
        const topupTask = await table.get("topup");
        if (topupTask) {
            console.log("Already started topup");
            return;
        }
      
        //await generateAccount("topup", gastank);
        return true;
    } else return false;
    */
}

var deployer1: number | undefined;
var deployer2: number | undefined;
var deployer3: number | undefined;

//TODO stop relying on AWS saving state in short term and replace with DynamoDB table logic
async function getDeployer(): Promise<PrivateKey> {
  let i: number = Math.floor(Math.random() * (GASTANKS.length - 1));
  let replenish: boolean = await checkGasTank(GASTANKS[i]);
  while (i === deployer1 || i === deployer2 || i === deployer3 || replenish) {
    console.error("Deployer was recently used or empty, finding another");
    i = Math.floor(Math.random() * (GASTANKS.length - 1));
    replenish = await checkGasTank(GASTANKS[i]);
  }
  // shifting last deployers
  deployer3 = deployer2;
  deployer2 = deployer1;
  deployer1 = i;

  const gastank = GASTANKS[i];
  console.log(
    `Using gas tank no ${i} with private key ${gastank}, last deployers:`,
    deployer1,
    deployer2,
    deployer3,
  );
  const deployerPrivateKey = PrivateKey.fromBase58(gastank);
  return deployerPrivateKey;
}

async function deployContract(id: string, nft: NamesData): Promise<void> {
  console.log("deployContract", id);

  try {
    const names = new Names(NAMES_TABLE);
    const name = await names.get(nft.username);
    if (name) {
      console.log("Found old deployment", name);
      return;
    }
    console.log("name", name);

    const bot = new BotMessage(id);
    if (nft.ipfs === "") {
      axios
        .get(
          `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/${nft.uri.image}`,
          {
            responseType: "arraybuffer",
          },
        )
        .then((response: any) => {
          console.log("cloudinary ping - aws");
        })
        .catch((e: any) => console.error("cloudinary ping - aws", e));
    }
    await minaInit();

    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPrivateKeyString = PrivateKey.toBase58(zkAppPrivateKey);
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    const zkAppAddressString = PublicKey.toBase58(zkAppPublicKey);
    const secret = Field.random();

    await bot.message(
      `NFT deployment (1/3): created NFT account ${zkAppAddressString}`,
    );

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
      const ipfs = new IPFS(PINATA_JWT);
      cidImage = await ipfs.addLink(nft.uri.image);
      if (cidImage) cidImage = `https://ipfs.io/ipfs/` + cidImage;
    } else cidImage = nft.uri.image;
    console.log("cidImage", cidImage);
    if (!cidImage || cidImage === "") {
      console.error("deployContract - addLink error");
      await bot.message(
        `NFT deployment: IPFS error. Cannot upload image. Please try again later by typing command "new"`,
      );
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
      await bot.message(
        `NFT deployment: IPFS error. Cannot upload URI. Please try again later by typing command "new"`,
      );
      return;
    }
    deployedNFT.ipfs = cidURI;

    console.log("Writing deployment to Names");
    await names.create(deployedNFT);
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
    /*
    await bot.message(
      `Compilation took ${delay}
Deploying your NFT smart contract to MINA blockchain...`,
    );
    console.log("verificationKey", verificationKey);
	  */
    const hash: string | undefined = await deploy(
      deployerPrivateKey,
      zkAppPrivateKey,
      zkApp,
      verificationKey,
      bot,
    );
    if (!hash || hash == "") {
      console.error("Error deploying contract");
      await bot.message(
        `NFT deployment: Error deploying contract to MINA blockchain. Please try again later by typing command "new"`,
      );
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
  } catch (err) {
    console.error(err);
  }
}

async function createNFT(id: string, nft: NamesData): Promise<void> {
  console.log("createNFT", id, nft);
  const bot = new BotMessage(id);
  if (!nft.deploy || !nft.ipfs || !nft.deploy.secret) {
    console.error("No nft.deploy or nft.ipfs or deploy.secret");
    await bot.message(
      `NFT deployment: Error deploying NFT to MINA blockchain. Please try again later by typing command "new"`,
    );
    return;
  }
  axios
    .get(
      `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${nft.uri.image}`,
      {
        responseType: "arraybuffer",
      },
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
  //await bot.message(`Creating Avatar NFT on MINA blockchain...`);

  console.log("Creating tx...");
  const deployerPrivateKey = await getDeployer();
  const deployerPublicKey = deployerPrivateKey.toPublicKey();
  await fetchAccount({ publicKey: deployerPublicKey });

  let sender = deployerPrivateKey.toPublicKey();
  const ipfsFields: Field[] | undefined = ipfsToFields("ipfs:" + nft.ipfs);
  if (!ipfsFields) {
    console.error("Error converting IPFS hash");
    await bot.message(
      `NFT deployment: Error converting IPFS hash of the NFT. Please try again later by typing command "new"`,
    );
    return;
  }
  let newsecret: Field;
  if (nft.deploy && nft.deploy.secret)
    newsecret = Field.fromJSON(nft.deploy.secret);
  else {
    console.error("No secret in nft.deploy.secret");
    await bot.message(
      `NFT deployment: Error deploying NFT to MINA blockchain. Cannot set new passsword for the NFT. Please try again later by typing command "new"`,
    );
    return;
  }

  /*
    @method createNFT(
        username: Field,
        publicMapRoot: Field,
        publicFilesRoot: Field,
        privateMapRoot: Field,
        privateFilesRoot: Field,
        uri1: Field,
        uri2: Field,
        salt: Field,
        secret: Field,
    ) {
 
*/
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
        Field.fromJSON(process.env.NFT_SECRET!), //TODO: change to random secret
      );
    },
  );

  const startTime1 = Date.now();
  await tx.prove();
  const endTime = Date.now();
  const delay3 = formatWinstonTime(endTime - startTime1);
  console.log("Proof took", delay3, ", now sending transaction...");
  //await bot.message(`Zero knowledge proof took ${delay3}`);
  tx.sign([deployerPrivateKey]); // deployerPrivateKey gasPrivateKey

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
    await bot.message(successMsg);
  } else {
    console.error("Send fail", sentTx);
    await bot.message(`Send fail`);
  }
  await sleep(1000);
  return;
}

async function topupAccount(publicKey: string) {
  Mina.faucet(PublicKey.fromBase58(publicKey)); //await
}

async function accountBalance(address: PublicKey): Promise<UInt64> {
  let check = await Mina.hasAccount(address);
  console.log("check1", check);
  if (!check) {
    await fetchAccount({ publicKey: address });
    check = await Mina.hasAccount(address);
    console.log("check2", check);
    if (!check) return UInt64.from(0);
  }
  const balance = await Mina.getBalance(address);
  return balance;
}

async function minaInit() {
  console.log("Initialising MINA from", MINAURL);
  await isReady;
  const Network = Mina.Network(MINAURL);
  await Mina.setActiveInstance(Network);
  console.log("SnarkyJS loaded");
}

const deployTransactionFee = 100_000_000;

async function deploy(
  deployerPrivateKey: PrivateKey,
  zkAppPrivateKey: PrivateKey,
  zkapp: AvatarNFT,
  verificationKey: { data: string; hash: string | Field },
  bot: BotMessage,
): Promise<string | undefined> {
  //const gasTank = process.env.GASTANKPRIVATEKEY!;
  //const gasPrivateKey = PrivateKey.fromBase58(gasTank);
  let sender = deployerPrivateKey.toPublicKey();
  //let sender = gasPrivateKey.toPublicKey();
  let zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  console.log("using deployer private key with public key", sender.toBase58());
  console.log(
    "using zkApp private key with public key",
    zkAppPublicKey.toBase58(),
  );

  console.log("Deploying zkapp for public key", zkAppPublicKey.toBase58());
  let transaction = await Mina.transaction(
    { sender, fee: deployTransactionFee, memo: "@minanft_bot" },
    () => {
      AccountUpdate.fundNewAccount(sender);
      // NOTE: this calls `init()` if this is the first deploy
      zkapp.deploy({ verificationKey });
    },
  );
  await transaction.prove();
  transaction.sign([deployerPrivateKey, zkAppPrivateKey]); //deployerPrivateKey gasPrivateKey

  console.log("Sending the deploy transaction...");
  const res = await transaction.send();
  const hash = res.hash();
  if (hash === undefined) {
    console.log("error sending deploy transaction");
  } else {
    console.log(
      "NFT deployment (2/3): smart contract deployed: ",
      "https://berkeley.minaexplorer.com/transaction/" + hash,
    );

    await bot.message(
      "NFT deployment (2/3): smart contract deployed: " +
        "https://berkeley.minaexplorer.com/transaction/" +
        hash,
    );
  }
  return hash;
}

function formatWinstonTime(ms: number): string {
  if (ms === undefined) return "";
  if (ms < 1000) return ms.toString() + " ms";
  if (ms < 60 * 1000)
    return parseInt((ms / 1000).toString()).toString() + " sec";
  if (ms < 60 * 60 * 1000)
    return parseInt((ms / 1000 / 60).toString()).toString() + " min";
  return parseInt((ms / 1000 / 60 / 60).toString()).toString() + " h";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { deployContract, checkBalance, createNFT };
