import {
  TreeElement,
  MerkleTreeWitness20,
  RedactedMinaNFTTreeCalculation20,
  RedactedMinaNFTTreeStateProof20,
  RedactedMinaNFTTreeState20,
  BackendPlugin,
} from "minanft";
import { Cache, verify, JsonProof, VerificationKey } from "o1js";

export class MinaNFTTreeVerifierPlugin20 extends BackendPlugin {
  static verificationKey: VerificationKey | undefined = undefined;

  constructor(params: { name: string; task: string; args: string[] }) {
    super(params);
  }
  public async compile(cache: Cache): Promise<void> {
    if (MinaNFTTreeVerifierPlugin20.verificationKey === undefined)
      MinaNFTTreeVerifierPlugin20.verificationKey = (
        await RedactedMinaNFTTreeCalculation20.compile({
          cache,
        })
      ).verificationKey;
    else console.log("verificationKey already exists");
  }

  public async create(transaction: string): Promise<string | undefined> {
    if (MinaNFTTreeVerifierPlugin20.verificationKey === undefined)
      throw new Error("verificationKey is undefined");
    const args = JSON.parse(transaction);
    const element = TreeElement.fromJSON(args.element);
    const originalWitness = MerkleTreeWitness20.fromJSON(args.originalWitness);
    const redactedWitness = MerkleTreeWitness20.fromJSON(args.redactedWitness);

    const proof = await RedactedMinaNFTTreeCalculation20.create(
      RedactedMinaNFTTreeState20.create(
        element,
        originalWitness,
        redactedWitness
      ),
      element,
      originalWitness,
      redactedWitness
    );
    console.time("verified proof");
    const ok = await verify(
      proof.toJSON(),
      MinaNFTTreeVerifierPlugin20.verificationKey
    );
    console.timeEnd("verified proof");
    if (!ok) throw new Error("proof verification failed");
    return JSON.stringify(proof.toJSON(), null, 2);
  }

  public async merge(
    proof1: string,
    proof2: string
  ): Promise<string | undefined> {
    if (MinaNFTTreeVerifierPlugin20.verificationKey === undefined)
      throw new Error("verificationKey is undefined");

    class TreeStateProof extends RedactedMinaNFTTreeStateProof20 {}

    const sourceProof1: TreeStateProof = TreeStateProof.fromJSON(
      JSON.parse(proof1) as JsonProof
    );
    const sourceProof2: TreeStateProof = TreeStateProof.fromJSON(
      JSON.parse(proof2) as JsonProof
    );
    const state = RedactedMinaNFTTreeState20.merge(
      sourceProof1.publicInput,
      sourceProof2.publicInput
    );
    const proof = await RedactedMinaNFTTreeCalculation20.merge(
      state,
      sourceProof1,
      sourceProof2
    );
    console.time("verified proof");
    const ok = await verify(
      proof.toJSON(),
      MinaNFTTreeVerifierPlugin20.verificationKey
    );
    console.timeEnd("verified proof");
    if (!ok) throw new Error("proof verification failed");
    return JSON.stringify(proof.toJSON(), null, 2);
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
