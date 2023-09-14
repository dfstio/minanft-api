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
  Encoding,
  UInt64,
  Poseidon,
} from "snarkyjs";
import AccountData from "../src/model/accountData";
import { MINAURL, MINAEXPLORER, MINAFEE } from "../env.json";

const FEE = 0.1e9;
const GASTANK_MINLIMIT = 100;

// gasTank B62qpS5u1jABA1XADyJXACJ7pahqetFsxr5UnniH7uK5hrqEfQmKxRt
const gasTankPrivateKey =
  "EKErpXScL8Y6UNg8yJgo1Hk78YnLMQ3f8xdTK1L3QjAmqw3TjJBA";

// account B62qmmmjRjsEM8xxwaoZuMSArSCCxEqa51bGD63QqoChBSuupA2f7At
const accountPrivateKey =
  "EKFHfhzJaPqZmvLxChhXL49V9c5rueiUrsXfrtEmNH413tdDxbaS";

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
  await isReady;
  const Network = Mina.Network(MINAURL);
  await Mina.setActiveInstance(Network);
  console.log("SnarkyJS loaded");
}

function makeString(length: number): string {
  let outString: string = "";
  let inOptions: string = "abcdefghijklmnopqrstuvwxyz0123456789_";

  for (let i = 0; i < length; i++) {
    outString += inOptions.charAt(Math.floor(Math.random() * inOptions.length));
  }
  return outString;
}

function ipfsToFields(ipfs: string): Field[] | undefined {
  try {
    const fields: Field[] = Encoding.stringToFields(ipfs);
    if (fields.length !== 2)
      console.error(
        "ipfsToFields error, length is",
        fields.length,
        ipfs,
        fields,
      );
    console.log("ipfsToFields length", fields.length, ipfs);
    const restored = fieldsToIPFS(fields);
    console.log("Restored: ", restored);
    if (ipfs !== restored) {
      console.error(
        "ipfsToFields restore error, length is",
        fields.length,
        ipfs,
        fields,
      );
      return undefined;
    }
    return fields;
  } catch (error: any) {
    console.error("ipfsToFields error", error);
    return undefined;
  }
}

function fieldsToIPFS(fields: Field[]): string | undefined {
  try {
    if (fields.length !== 2)
      console.error("fieldsToIPFS error, length is", fields.length);
    return Encoding.stringFromFields(fields);
  } catch (error: any) {
    console.error("fieldsToIPFS error", error);
    return undefined;
  }
}

async function main() {
  await minaInit();

  let i = 1;
  //const str = "ipfs:QmRnawj2mN6AJEyUGAN96cpjUUjxK3icU6GLLwAbxb4EZT";
  const str = "arweave:keucvwznkccczbu6gcxazh5y54pqcn2dpzpcrcuhve6m42zo4mva"; // "@" + makeString(29);
  const fieldsStr: Field[] = Encoding.stringToFields(str);
  const str1 = Encoding.stringFromFields(fieldsStr);

  console.log(str === str1, fieldsStr.length, "\n", str, "\n", str1);
  for (const f of fieldsStr) console.log(Field.toJSON(f));

  const fields: Field[] | undefined = ipfsToFields(str);
  if (fields) {
    console.log(fields.length, "\n", str);
    for (const f of fields) console.log(Field.toJSON(f));

    const ipfs: string | undefined = fieldsToIPFS(fields);
    if (ipfs) {
      console.log(str === ipfs, fields.length, "\n", str, "\n", ipfs);
      for (const f of fields) console.log(Field.toJSON(f));
    }
  }

  /*
  const f: Field = Field.random();
  const salt: Field = Field.random();
  console.log("f", Field.toJSON(f), "\nsalt", Field.toJSON(f), 
  	"\nhash", Field.toJSON(Poseidon.hash([ salt, f ])));

	const MAX_NUMBER = Number("28948022309329048855892746252171976963363056481941560715954676764349967630336");
  let str = "0xF";
  
  let i = 1;
  while(Number(str)<MAX_NUMBER) {str=str+"F"; i++ }
  console.log(i, str, (Number(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) < MAX_NUMBER));
*/

  /*
  const accountPrivateKeyMina = PrivateKey.fromBase58(accountPrivateKey);
  const accountPublicKeyMina = accountPrivateKeyMina.toPublicKey();
  const gasTankPrivateKeyMina = PrivateKey.fromBase58(gasTankPrivateKey);
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

  const balanceAccount = await accountBalance(accountPublicKeyMina);
  const balanceAccountMina = Number(balanceAccount.toBigInt()) / 1e9;
  console.log("Balance of account", balanceAccountMina.toLocaleString("en"));

  if (replenishGasTank && balanceAccount.toBigInt() > Number(FEE)) {
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

    if (sentTx.hash() !== undefined) {
      console.log(`
Success! transaction sent:
https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
	`);
    } else console.error("Send fail", sentTx);
  }
  */
  await shutdown();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
