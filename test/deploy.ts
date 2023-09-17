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
} from "o1js";
import AccountData from "../src/model/accountData";
import {
  MINAURL,
  MINAEXPLORER,
  MINAFEE,
  NFT_SALT,
  NFT_SECRET,
} from "../env.json";
//const NFT_SECRET : Field = Field(27);

class MerkleWitness10 extends MerkleWitness(10) { }

export class NFT extends SmartContract {
  @state(Field) username = State<Field>();
  @state(Field) pwd = State<Field>();
  @state(Field) merkleRoot = State<Field>();
  @state(Field) nonce = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      setPermissions: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
  }

  @method init() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertFalse();

    super.init();

    this.pwd.set(
      Poseidon.hash([Field.fromJSON(NFT_SALT), Field.fromJSON(NFT_SECRET)]),
    );
  }

  // Create NFT on the MINA blockchain

  @method mintNew(secret: Field) {
    this.pwd.set(secret);
  }

  @method mint(secret: Field, username: Field, merkleRoot: Field) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const pwd = this.pwd.get();
    this.pwd.assertEquals(pwd);
    this.pwd.assertEquals(Poseidon.hash([Field.fromJSON(NFT_SALT), secret]));

    const nonce = this.nonce.get();
    this.nonce.assertEquals(nonce);
    this.nonce.assertEquals(Field(0));
    this.nonce.set(nonce.add(Field(1)));

    this.merkleRoot.set(merkleRoot);
    this.username.set(username);
  }

  @method check(usernameCheck: Field, witness: MerkleWitness10, value: Field) {
    const username = this.username.get();
    this.username.assertEquals(username);
    this.username.assertEquals(usernameCheck);
    const calculatedRoot: Field = witness.calculateRoot(value);
    const merkleRoot = this.merkleRoot.get();
    this.merkleRoot.assertEquals(merkleRoot);
    this.merkleRoot.assertEquals(calculatedRoot);
  }

  @method checkLess(secret: Field, usernameCheck: Field) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const pwd = this.pwd.get();
    this.pwd.assertEquals(pwd);
    this.pwd.assertEquals(Poseidon.hash([Field.fromJSON(NFT_SALT), secret]));

    const nonce = this.nonce.get();
    this.nonce.assertEquals(nonce);
    this.nonce.set(nonce.add(Field(1)));

    const username = this.username.get();
    this.username.assertEquals(username);
    username.assertLessThan(usernameCheck, "Error - less");
  }
}

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
  console.log("check1", check);
  if (!check) {
    await fetchAccount({ publicKey: address });
    check = await Mina.hasAccount(address);
    console.log("check2", check);
    if (!check) return 0;
  }
  const balance = await Mina.getBalance(address);
  return balance.toBigInt();
}

async function minaInit() {
  await isReady;
  const Network = Mina.Network(MINAURL);
  await Mina.setActiveInstance(Network);
  console.log("o1js loaded");
}

const deployTransactionFee = 100_000_000;

async function deploy(
  deployerPrivateKey: PrivateKey,
  zkAppPrivateKey: PrivateKey,
  zkapp: NFT,
  verificationKey: { data: string; hash: string | Field },
) {
  let sender = deployerPrivateKey.toPublicKey();
  let zkAppPublicKey = zkAppPrivateKey.toPublicKey();
  console.log("using deployer private key with public key", sender.toBase58());
  console.log(
    "using zkApp private key with public key",
    zkAppPublicKey.toBase58(),
  );

  console.log("Deploying zkapp for public key", zkAppPublicKey.toBase58());
  let transaction = await Mina.transaction(
    { sender, fee: deployTransactionFee },
    () => {
      AccountUpdate.fundNewAccount(sender);
      // NOTE: this calls `init()` if this is the first deploy
      zkapp.deploy({ verificationKey });
      zkapp.mintNew(Field(5));
    },
  );
  await transaction.prove();
  transaction.sign([deployerPrivateKey, zkAppPrivateKey]);

  console.log("Sending the deploy transaction...");
  const res = await transaction.send();
  const hash = res.hash();
  if (hash === undefined) {
    console.log("error sending transaction (see above)");
  } else {
    console.log(
      "See deploy transaction at",
      "https://berkeley.minaexplorer.com/transaction/" + hash,
    );
    console.log("waiting for zkApp account to be deployed...");
    await res.wait();
  }
}

function calculateMerkleTreeHeight(n: number): number {
  // We'll use the Math.log2 function to calculate the log base 2 of n,
  // and Math.ceil to round up to the nearest integer
  return Math.ceil(Math.log2(n)) + 1;
}

/*
let numberOfElements = 10;
let height = calculateMerkleTreeHeight(numberOfElements);
console.log(`The height of the Merkle tree needed to hold ${numberOfElements} elements is ${height}.`);
*/

async function main() {
  await minaInit();
  /*

    const text = "123456789";
    const sanitizedText = "1234XX789";
    const height: number = 10; //calculateMerkleTreeHeight(text.length);

    const tree: MerkleTree = new MerkleTree(height);
    class MyMerkleWitness extends MerkleWitness(height) {}
    let i: number;
    let textFields: Field[] = [];
    for (i = 0; i < text.length; i++)
        textFields.push(Encoding.stringToFields(text.substr(i, 1))[0]);
    await tree.fill(textFields);
    const root: Field = tree.getRoot();
    console.log("root", Field.toJSON(root));

    let wa = [];
    for (i = 0; i < text.length; i++) {
        const wt = await tree.getWitness(BigInt(i));
        wa.push(wt);
    }
    console.log("wa", wa);

    for (i = 0; i < text.length; i++) {
        const w = new MyMerkleWitness(wa[i]);
        const calculatedRoot: Field = w.calculateRoot(
            Encoding.stringToFields(text.substr(i, 1))[0],
        );
        console.log(
            "test passed",
            i,
            Field.toJSON(root) === Field.toJSON(calculatedRoot),
        );
    }

 
    const { verificationKey } = await MT.compile();
    console.log("Compiled");

 
    try{
    const p1 = await MT.mint(Field(0));
    const ok1 = await verify(p1.toJSON(), verificationKey);
    console.log("ok1", ok1);
    } catch (error: any) { console.log("not ok1");}
  	
        try{
    const p2 = await MT.mint(Field(1));
    const ok2 = await verify(p2.toJSON(), verificationKey);
    console.log("ok2", ok2);
        } catch (error: any) { console.log("not ok2");}
  
    //const f: Field = Field.random();
    //console.log("f", Field.toJSON(f));

    /*
B62qmtSwP89RPp9ws57YG2PE6CxDTqJqanNVCHiU4rzfQfAHj9wVnkG. 
Your private key is EKE6fs4PPpeJU5dwJS9v4KCXGHzjVJS5sWTTj6iz34AMxGSM17Mv
*/

  const balanceFaucet = await accountBalance(
    "B62qmtSwP89RPp9ws57YG2PE6CxDTqJqanNVCHiU4rzfQfAHj9wVnkG",
  );
  console.log(
    "Balance of faucet",
    (Number(balanceFaucet) / 1e9).toLocaleString("en"),
  );

  /*
  let txStatus: TransactionStatus;
  const tx = "5JtqdCwqVRR9yRSSZt7wy1YognMha6fKXjH7PwSpsJ874wDBgg2S";
  try {
    txStatus = await fetchTransactionStatus(tx);
  } catch (error) {
    console.error(
      "catch fetchTransactionStatus",
      error,
      (<any>error).toString(),
    );
    return;
  }
  console.log("tx status", txStatus);
*/
  const acc = generateAccount();
  console.log("Account", acc);

  /*
  let balance = await accountBalance(acc.publicKey);
  console.log(
    "Balance before topup",
    (Number(balance) / 1e9).toLocaleString("en"),
  );
  const startTime1 = Date.now();
  await topupAccount(acc.publicKey);
  const deployTime1 = Date.now();
  const delay21 = formatWinstonTime(deployTime1 - startTime1);
  console.log("topup took", delay21);

  balance = await accountBalance(acc.publicKey);
  console.log(
    "Balance after topup",
    (Number(balance) / 1e9).toLocaleString("en"),
  );

   */
  const deployerPrivateKey = PrivateKey.fromBase58(
    "EKE6fs4PPpeJU5dwJS9v4KCXGHzjVJS5sWTTj6iz34AMxGSM17Mv",
  );
  const deployerPublicKey = deployerPrivateKey.toPublicKey();

  const zkAppPrivateKey = PrivateKey.fromBase58(acc.privateKey);
  //const zkAppPrivateKey = PrivateKey.fromBase58(acc.privateKey);
  const zkAppPublicKey = zkAppPrivateKey.toPublicKey();

  let zkApp = new NFT(zkAppPublicKey);

  const startTime = Date.now();
  // compile the contract to create prover keys
  console.log("Compiling smart contract...");
  let { verificationKey } = await NFT.compile();
  const compileTime = Date.now();
  const delay = formatWinstonTime(compileTime - startTime);
  console.log("Compilation took", delay);
  //console.log('verificationKey', verificationKey);

  await deploy(deployerPrivateKey, zkAppPrivateKey, zkApp, verificationKey);

  const deployTime = Date.now();
  const delay2 = formatWinstonTime(deployTime - compileTime);
  console.log("Deployment took", delay2);
  /*
    console.log("Creating tx...");
    const tx = await Mina.transaction(
        { sender: deployerPublicKey, fee: 0.1e9 },
        () => {
            zkApp.mint(Field(0));
        },
    );

    const proofs = await tx.prove();
    const endTime = Date.now();
    const delay3 = formatWinstonTime(endTime - deployTime);
    console.log(
        "Proof took",
        delay3,
        ", now sending transaction...",
        proofs.length,
    );
    //for (const proof of proofs) console.log(proof ? proof.toJSON() : "");

    tx.sign([deployerPrivateKey]);
    let sentTx = await tx.send();

    if (sentTx.hash() !== undefined) {
        console.log(`
  Success! Update transaction sent.

  Your smart contract state will be updated
  as soon as the transaction is included in a block:
  https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
  `);
        await sentTx.wait();
    } else console.error("Send fail", sentTx);
    /*
  
  
  console.log("Creating tx2...");
  const tx2 = await Mina.transaction(
    { sender: deployerPublicKey, fee: 0.1e9 },
    () => {
      zkApp.check(Field.fromJSON(NFT_SECRET), Field(5));
    }
  );
  const proofs2  = await tx2.prove();
  console.log("Proof", proofs2.length );
  for( const proof of proofs2) console.log(proof? proof.toJSON() : "");
  tx2.sign([deployerPrivateKey]);
  let sentTx2 = await tx2.send();

  if (sentTx2.hash() !== undefined) {
    console.log(`
  Success! Update transaction sent.

  Your smart contract state will be updated
  as soon as the transaction is included in a block:
  https://berkeley.minaexplorer.com/transaction/${sentTx2.hash()}
  `);
  await sentTx2.wait();
  } else console.error("Send fail", sentTx2);



  console.log("Creating tx3...");
  const tx3 = await Mina.transaction(
    { sender: deployerPublicKey, fee: 0.1e9 },
    () => {
      zkApp.checkLess(Field.fromJSON(NFT_SECRET), Field(7));
    }
  );
  const proofs3  = await tx3.prove();
  console.log("Proof", proofs3.length );
  for( const proof of proofs3) { if( proof ) {console.log(proof.toJSON()); await proof.verify(); }}
  tx3.sign([deployerPrivateKey]);
  let sentTx3 = await tx3.send();

  if (sentTx3.hash() !== undefined) {
    console.log(`
  Success! Update transaction sent.

  Your smart contract state will be updated
  as soon as the transaction is included in a block:
  https://berkeley.minaexplorer.com/transaction/${sentTx3.hash()}
  `);
  await sentTx3.wait();
  } else console.error("Send fail", sentTx3);



    console.log("Creating tx4...");
    const tx4 = await Mina.transaction(
        { sender: deployerPublicKey, fee: 0.1e9 },
        () => {
            let k: number;
            for (k = 0; k < text.length; k++) {
                const startTime = Date.now();
                const wt = tree.getWitness(BigInt(k));
                const w = new MyMerkleWitness(wt);
                const witnessTime = Date.now();
                const delayWitness = formatWinstonTime(witnessTime - startTime);
                console.log(`Witness ${k} took`, delayWitness);
                zkApp.check(
                    Field(5),
                    w,
                    Encoding.stringToFields(text.substr(k, 1))[0],
                );
            }
        },
    );
    //const transaction : any = await tx4.toJSON();
    //console.log("Transaction:", transaction);
    const proofs4 = await tx4.prove();
    console.log("Proof", proofs4.length);
    for (const proof of proofs4) {
        if (proof) {
            const proofJson = await proof.toJSON();
            //let publicInput : Field[] = [Field(0)];
            console.log("proofJson.publicInput", proofJson.publicInput);
            //for( const item of proofJson.publicInput) publicInput.push(Field.fromJSON(item));
            //console.log("publicInput", publicInput.length);
            const result = await verify(proof, verificationKey.data);
            console.log("Proof result:", result);
        }
    }
    tx4.sign([deployerPrivateKey]);

    let sentTx4 = await tx4.send();

    if (sentTx4.hash() !== undefined) {
        console.log(`
  Success! Update transaction sent.

  Your smart contract state will be updated
  as soon as the transaction is included in a block:
  https://berkeley.minaexplorer.com/transaction/${sentTx4.hash()}
  `);
        await sentTx4.wait();
    } else console.error("Send fail", sentTx4);
    /*
    console.log("Creating tx5...");
    const tx5 = await Mina.transaction(
        { sender: deployerPublicKey, fee: 0.1e9 },
        () => {
            zkApp.check(Field(7));
        },
    );
    const proofs5 = await tx5.prove();
    console.log("Proof", proofs5.length);
    for (const proof of proofs5) {
        if (proof) {
            const proofJson = await proof.toJSON();
            //let publicInput : Field[] = [Field(0)];
            console.log("proofJson.publicInput", proofJson.publicInput);
            //for( const item of proofJson.publicInput) publicInput.push(Field.fromJSON(item));
            //console.log("publicInput", publicInput.length);
            const result = await verify(proof, verificationKey.data);
            console.log("Proof result:", result);
        }
    }
    tx5.sign([deployerPrivateKey]);

    let sentTx5 = await tx5.send();

    if (sentTx5.hash() !== undefined) {
        console.log(`
  Success! Update transaction sent.

  Your smart contract state will be updated
  as soon as the transaction is included in a block:
  https://berkeley.minaexplorer.com/transaction/${sentTx5.hash()}
  `);
        await sentTx5.wait();
    } else console.error("Send fail", sentTx5);

    /*

  // create a destination we will deploy the smart contract to
  const zkAppPrivateKey = PrivateKey.random();
  const zkFaucet = PrivateKey.fromBase58("EKEuXCfveWYbu1feMMUzuNyuxsyki22TEySgzzD4tPdxMkevGaSC"); 
  const zkFaucetAddress = zkFaucet.toPublicKey();
  //const zkFaucetAddressString = PublicKey.toBase58(zkFaucetAddress);
  await fetchAccount({ publicKey: zkFaucetAddress });
  const check = await Mina.hasAccount(zkFaucetAddress);
  const balance = await Mina.getBalance(zkFaucetAddress);

  const balanceString = (Number(balance.toBigInt()) / 1e9).toLocaleString('en')
  console.log("Faucet balance", balanceString, check);
  const zkAppPrivateKeyString = PrivateKey.toBase58(zkAppPrivateKey);
  const zkAppAddress = zkAppPrivateKey.toPublicKey();
  const zkAppAddressString = PublicKey.toBase58(zkAppAddress);
	
  console.log("zkAppPrivateKey", zkAppPrivateKeyString, "zkAppAddress", zkAppAddressString);
	
  //await Mina.faucet(zkAppAddress);
  //await Mina.waitForFunding(zkAppAddressString);
  console.log(`View your account on https://berkeley.minaexplorer.com/wallet/${zkAppAddressString}`);
  */
  await shutdown();
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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

//zkAppPrivateKey EKEuXCfveWYbu1feMMUzuNyuxsyki22TEySgzzD4tPdxMkevGaSC
//zkAppAddress B62qrgQizVm4k8YTyQgoTfLKBJ2MYcUo3RyZ7xVkq1tEi7w1rSF3H39
// B62qrgQizVm4k8YTyQgoTfLKBJ2MYcUo3RyZ7xVkq1tEi7w1rSF3H39

// privateKey: 'EKEjdi6KegtBmsJxv8fhu4Jj3aTwER6n3nZpfpqWubMrNEPq1dsr',
//  publicKey: 'B62qrFqrkQKzjyJheobKqYCZULAhWwx58NPDgT5yBjfofdAJQiFNWn2',
//  explorer: 'https://berkeley.minaexplorer.com/wallet/B62qrFqrkQKzjyJheobKqYCZULAhWwx58NPDgT5yBjfofdAJQiFNWn2'
