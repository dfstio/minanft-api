import { BackendPlugin, MinaNFT } from "minanft";
import {
  Cache,
  VerificationKey,
  MerkleWitness,
  SmartContract,
  state,
  State,
  method,
  Field,
  PrivateKey,
  PublicKey,
  Mina,
  fetchAccount,
} from "o1js";
//import { minaInit } from "../mina/init";
//import { GASTANKS } from "../mina/gastanks";

class MerkleTreeWitness20 extends MerkleWitness(20) {}

class RealTimeVoting extends SmartContract {
  @state(Field) root = State<Field>();
  @state(Field) counter = State<Field>();

  @method async addVoteToMerkleTree(
    guaranteedState: Field,
    newState: Field,
    witness: MerkleTreeWitness20,
    value: Field
  ) {
    const calculatedRoot = witness.calculateRoot(value);
    const oldCalculatedRoot = witness.calculateRoot(Field(0));
    guaranteedState.assertEquals(oldCalculatedRoot);
    newState.assertEquals(calculatedRoot);
    this.root.set(newState);
    this.counter.set(value);
  }
}

const transactionFee = 10_000_000;

export class RFCvoting extends BackendPlugin {
  static verificationKey: VerificationKey | undefined = undefined;

  constructor(params: { name: string; task: string; args: string[] }) {
    super(params);
  }
  public async compile(cache: Cache): Promise<void> {
    if (RFCvoting.verificationKey === undefined)
      RFCvoting.verificationKey = (
        await RealTimeVoting.compile({
          cache,
        })
      ).verificationKey;
    else console.log("verificationKey already exists");
  }

  public async create(transaction: string): Promise<string | undefined> {
    if (RFCvoting.verificationKey === undefined)
      throw new Error("verificationKey is undefined");
    MinaNFT.minaInit("zeko");
    const deployer = PrivateKey.fromBase58(process.env.DEPLOYER_LIB!);
    //const deployer = PrivateKey.fromBase58(GASTANKS[14]);
    const sender = deployer.toPublicKey();
    const args = JSON.parse(transaction);
    const id: number = parseInt(args.id);
    const oldRoot: Field = Field.fromJSON(args.oldRoot);
    const newRoot: Field = Field.fromJSON(args.newRoot);
    const witness: MerkleTreeWitness20 = MerkleTreeWitness20.fromJSON(
      args.witness
    ) as MerkleTreeWitness20;
    const value: Field = Field.fromJSON(args.value);
    const votingPrivateKey: PrivateKey = PrivateKey.fromBase58(this.args[0]);
    const nonce: number = parseInt(this.args[1]);
    const votingPublicKey: PublicKey = votingPrivateKey.toPublicKey();

    const zkApp = new RealTimeVoting(votingPublicKey);
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: votingPublicKey });
    const tx = await Mina.transaction(
      { sender, fee: transactionFee, nonce: nonce + id, memo: "zkCloudWorker" },
      async () => {
        await zkApp.addVoteToMerkleTree(oldRoot, newRoot, witness, value);
      }
    );
    await tx.prove();
    tx.sign([deployer, votingPrivateKey]);
    return JSON.stringify({ i: id.toString(), tx: tx.toJSON() }, null, 2);
  }

  public async merge(
    proof1: string,
    proof2: string
  ): Promise<string | undefined> {
    throw new Error("not implemented");
  }

  public async mint(transaction: string): Promise<string | undefined> {
    throw new Error("not implemented");
  }
  public async verify(proof: string): Promise<string | undefined> {
    throw new Error("not implemented");
  }
  public async send(transaction: string): Promise<string | undefined> {
    throw new Error("not implemented");
  }
}
