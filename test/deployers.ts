import {
  Mina,
  PrivateKey,
  PublicKey,
  isReady,
  Field,
  fetchAccount,
  fetchTransactionStatus,
  TransactionStatus,
  shutdown,
  AccountUpdate,
  SmartContract,
  state,
  State,
  method,
  Signature,
  UInt64,
  DeployArgs,
  Permissions,
  Poseidon,
  Proof,
  MerkleTree,
  MerkleMapWitness,
  Encoding,
  MerkleWitness,
  SelfProof,
  Experimental,
  verify,
} from "snarkyjs";
import AccountData from "../src/model/accountData";
import {
  MINAURL,
  MINAEXPLORER,
  MINAFEE,
  NFT_SALT,
  NFT_SECRET,
} from "../env.json";
//const NFT_SECRET : Field = Field(27);

function generateAccount(): AccountData {
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppPrivateKeyString = PrivateKey.toBase58(zkAppPrivateKey);
  const zkAppAddress = zkAppPrivateKey.toPublicKey();
  const zkAppAddressString = PublicKey.toBase58(zkAppAddress);
  const salt = Field.random();

  return {
    privateKey: zkAppPrivateKeyString,
    publicKey: zkAppAddressString,
    explorer: `${MINAEXPLORER}${zkAppAddressString}`,
    salt: salt.toJSON(),
  };
}

async function topupAccount(publicKey: string) {
  await Mina.faucet(PublicKey.fromBase58(publicKey));
}

async function accountBalance(publicKey: string) {
  const address = PublicKey.fromBase58(publicKey);
  let check = await Mina.hasAccount(address);
  //console.log("check1", check);
  if (!check) {
    await fetchAccount({ publicKey: address });
    check = await Mina.hasAccount(address);
    //console.log("check2", check);
    if (!check) return 0;
  }
  const balance = await Mina.getBalance(address);
  return balance.toBigInt();
}

async function minaInit() {
  await isReady;
  const Network = Mina.Network(MINAURL);
  await Mina.setActiveInstance(Network);
  console.log("SnarkyJS loaded");
}

const deployTransactionFee = 100_000_000;

async function main() {
  await minaInit();
  let i: number;
  for (i = 0; i < 100; i++) {
    try {
      const acc = generateAccount();
      console.log(`"${acc.privateKey}",`);
      await topupAccount(acc.publicKey);
      const delay: number =
        1000 * 60 + Math.floor(Math.random() * (1000 * 60 * 10));
      await sleep(delay);
      const balance = await accountBalance(acc.publicKey);
      if (balance == 0) console.error("Zero balance");
    } catch (error: any) {
      console.log(error);
      await sleep(1000 * 60 * 10);
    }
  }

  await shutdown();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
