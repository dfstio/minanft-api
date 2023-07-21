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
} from "snarkyjs";

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

const MINAURL = process.env.MINAURL
  ? process.env.MINAURL
  : "https://proxy.berkeley.minaexplorer.com/graphql";
const MINAEXPLORER = process.env.MINAEXPLORER
  ? process.env.MINAEXPLORER
  : "https://berkeley.minaexplorer.com/wallet/";

const PRIVATEKEY = process.env.PRIVATEKEY!;
const GASTANKPRIVATEKEY = process.env.GASTANKPRIVATEKEY!;
const FEE = 0.1e9;
const GASTANK_MINLIMIT = 100;
const TASKS_TABLE = process.env.TASKS_TABLE!;
const NAMES_TABLE = process.env.NAMES_TABLE!;
const PINATA_JWT = process.env.PINATA_JWT!;

async function generateAccount(id: string): Promise<void> {
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
    taskdata: result,
  };
  await table.create(task);
}

async function checkBalance(id: string, data: AccountData): Promise<void> {
  console.log("Checking balance...", id, data);
  if (!data) {
    console.error("Wrong topup data");
    return;
  }
  const bot = new BotMessage(id);

  await minaInit();
  const accountPrivateKeyMina = PrivateKey.fromBase58(data.privateKey);
  const accountPublicKeyMina = accountPrivateKeyMina.toPublicKey();
  const gasTankPrivateKeyMina = PrivateKey.fromBase58(GASTANKPRIVATEKEY);
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
    await table.remove("topup");

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

async function checkGasTank(): Promise<void> {
  const gasTankPrivateKeyMina = PrivateKey.fromBase58(GASTANKPRIVATEKEY);
  const gasTankPublicKeyMina = gasTankPrivateKeyMina.toPublicKey();

  const balanceGasTank = await accountBalance(gasTankPublicKeyMina);
  const balanceGasTankMina = Number(balanceGasTank.toBigInt()) / 1e9;
  const replenishGasTank: boolean = balanceGasTankMina < GASTANK_MINLIMIT;
  console.log(
    "Balance of gas tank",
    balanceGasTankMina.toLocaleString("en"),
    "needs replenishing:",
    replenishGasTank,
  );

  if (replenishGasTank) {
    const table = new Tasks(TASKS_TABLE);
    const topupTask = await table.get("topup");
    if (topupTask) {
      console.log("Already startet topup");
      return;
    }
    await generateAccount("topup");
  }
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

    await minaInit();
    await checkGasTank();

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
    const ipfs = new IPFS(PINATA_JWT);
    let cidImage: string | undefined = await ipfs.addLink(nft.uri.image);
    console.log("cidImage", cidImage);
    if (!cidImage) {
      console.error("deployContract - addLink error");
      await bot.message(
        `NFT deployment: IPFS error. Cannot upload image. Please try again later by typing command "new"`,
      );
      return;
    }

    let deployedNFT: NamesData = nft;
    deployedNFT.deploy = result;
    deployedNFT.uri.image = `https://ipfs.io/ipfs/` + cidImage;
    deployedNFT.uri.minaPublicKey = zkAppAddressString;
    deployedNFT.uri.minaExplorer = `${MINAEXPLORER}${zkAppAddressString}`;

    let cidURI: string | undefined = await ipfs.add(deployedNFT.uri);
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

    const deployerPrivateKey = PrivateKey.fromBase58(GASTANKPRIVATEKEY);
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
    const hash: string = await deploy(
      deployerPrivateKey,
      zkAppPrivateKey,
      zkApp,
      verificationKey,
      bot,
    );
    if (hash == "") {
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

function ipfsToFields(ipfs: string): Field[] {
  const fields: Field[] = Encoding.stringToFields(ipfs);
  console.log("ipfsToFields length", fields.length, ipfs);
  const answer = [fields[0], fields.length > 1 ? fields[1] : Field(0)];
  //const restored = fieldsToIPFS(answer);
  //console.log("Restored: ", restored);
  if (fields.length > 2)
    console.error("ipfsToFields error, length is", fields.length);

  return answer;
}

/*
function fieldsToIPFS(fields: Field[]): string {
  return fields[1].equals(Field(0))
    ? Encoding.stringFromFields([fields[0]])
    : Encoding.stringFromFields(fields);
}
*/

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
  const deployerPrivateKey = PrivateKey.fromBase58(GASTANKPRIVATEKEY);
  const deployerPublicKey = deployerPrivateKey.toPublicKey();
  await fetchAccount({ publicKey: deployerPublicKey });

  let sender = deployerPrivateKey.toPublicKey();
  const ipfsFields: Field[] = ipfsToFields(nft.ipfs);
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

  const tx = await Mina.transaction(
    {
      sender,
      fee: 0.1e9,
      memo: "@minanft_bot",
    },
    () => {
      zkApp.createNFT(
        Field.fromJSON(process.env.NFT_SECRET!), // secret:
        newsecret, //newsecret:
        Encoding.stringToFields("@" + nft.username)[0], //username:
        ipfsFields[0], //uri1:
        ipfsFields[1], //uri2:
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
    const successMsg = `Success! NFT deployment (3/3): NFT is written to MINA blockchain: 
https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}

If you want to create one more NFT, type command "new"`;
    console.log(successMsg);
    await bot.message(successMsg);
    const table = new Tasks(TASKS_TABLE);
    await table.remove(id);
    await sleep(1000);
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
