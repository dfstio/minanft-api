import {
  MinaNFT,
  RedactedMinaNFTMapCalculation,
  RedactedMinaNFTMapState,
  RedactedMinaNFTMapStateProof,
  MapElement,
  MetadataWitness,
  BackendPlugin,
  VERIFIER,
  MINANFT_NAME_SERVICE,
  accountBalanceMina,
  blockchain,
} from "minanft";
import {
  Cache,
  verify,
  JsonProof,
  VerificationKey,
  Field,
  PublicKey,
} from "o1js";
import { getDeployer } from "../mina/deployers";
const blockchainToDeploy: blockchain = "testworld2";

export class MapProofPlugin extends BackendPlugin {
  static verificationKey: VerificationKey | undefined = undefined;

  constructor(params: { name: string; task: string; args: string[] }) {
    super(params);
  }
  public async compile(cache: Cache): Promise<void> {
    if (this.task === "send") {
      MinaNFT.setCache(cache);
      await MinaNFT.compileVerifier();
    } else if (MapProofPlugin.verificationKey === undefined)
      MapProofPlugin.verificationKey = (
        await RedactedMinaNFTMapCalculation.compile({
          cache,
        })
      ).verificationKey;
    else console.log("verificationKey already exists");
  }

  public async create(transaction: string): Promise<string | undefined> {
    if (MapProofPlugin.verificationKey === undefined)
      throw new Error("verificationKey is undefined");
    const args = JSON.parse(transaction);
    const element = MapElement.fromFields(
      args.element.map((f: string) => Field.fromJSON(f))
    ) as MapElement;
    const originalWitness = MetadataWitness.fromFields(
      args.originalWitness.map((f: string) => Field.fromJSON(f))
    ) as MetadataWitness;
    const redactedWitness = MetadataWitness.fromFields(
      args.redactedWitness.map((f: string) => Field.fromJSON(f))
    ) as MetadataWitness;

    const proof = await RedactedMinaNFTMapCalculation.create(
      RedactedMinaNFTMapState.create(element, originalWitness, redactedWitness),
      element,
      originalWitness,
      redactedWitness
    );
    const ok = await verify(proof.toJSON(), MapProofPlugin.verificationKey);
    if (!ok) throw new Error("proof verification failed");
    return JSON.stringify(proof.toJSON(), null, 2);
  }

  public async merge(
    proof1: string,
    proof2: string
  ): Promise<string | undefined> {
    if (MapProofPlugin.verificationKey === undefined)
      throw new Error("verificationKey is undefined");

    const sourceProof1: RedactedMinaNFTMapStateProof =
      RedactedMinaNFTMapStateProof.fromJSON(JSON.parse(proof1) as JsonProof);
    const sourceProof2: RedactedMinaNFTMapStateProof =
      RedactedMinaNFTMapStateProof.fromJSON(JSON.parse(proof2) as JsonProof);
    const state = RedactedMinaNFTMapState.merge(
      sourceProof1.publicInput,
      sourceProof2.publicInput
    );
    const proof = await RedactedMinaNFTMapCalculation.merge(
      state,
      sourceProof1,
      sourceProof2
    );
    const ok = await verify(proof.toJSON(), MapProofPlugin.verificationKey);
    if (!ok) throw new Error("proof verification failed");
    return JSON.stringify(proof.toJSON(), null, 2);
  }

  public async verify(proof: string): Promise<string | undefined> {
    if (MapProofPlugin.verificationKey === undefined)
      throw new Error("verificationKey is undefined");
    const ok = await verify(
      JSON.parse(proof) as JsonProof,
      MapProofPlugin.verificationKey
    );
    return ok ? "true" : "false";
  }

  public async send(transaction: string): Promise<string | undefined> {
    MinaNFT.minaInit(blockchainToDeploy);
    const proof: RedactedMinaNFTMapStateProof =
      RedactedMinaNFTMapStateProof.fromJSON(
        JSON.parse(transaction) as JsonProof
      );
    const nameServiceAddress = PublicKey.fromBase58(MINANFT_NAME_SERVICE);
    const deployer = await getDeployer();
    console.log(
      `Deployer balance: ${await accountBalanceMina(deployer.toPublicKey())}`
    );

    const tx = await MinaNFT.verify({
      deployer,
      verifier: PublicKey.fromBase58(VERIFIER),
      nft: PublicKey.fromBase58(this.args[0]),
      nameServiceAddress,
      proof,
    });

    if (tx === undefined) throw new Error("tx is undefined");
    const hash: string | undefined = tx.hash();
    if (hash === undefined) throw new Error("hash is undefined");
    return hash;
  }

  public async mint(transaction: string): Promise<string | undefined> {
    throw new Error("not implemented");
  }
}
