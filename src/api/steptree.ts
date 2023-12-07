import Steps from "../table/steps";
import { StepsData } from "../model/stepsData";
import callLambda from "../lambda/lambda";
import {
  MinaNFTTreeVerifierFunction,
  Memory,
  TreeElement,
  BackendPlugin,
} from "minanft";
import { Cache, verify, JsonProof, VerificationKey } from "o1js";

export class MinaNFTTreeVerifierPlugin extends BackendPlugin {
  contracts: any;
  static verificationKey: string | undefined = undefined;

  constructor(params: { name: string; task: string; args: string[] }) {
    super(params);
    if (params.args.length !== 1) throw new Error("arguments length not 1");
    const height = Number(params.args[0]);
    this.contracts = MinaNFTTreeVerifierFunction(height);
  }
  public async compile(cache: Cache): Promise<VerificationKey[] | undefined> {
    const { RedactedMinaNFTTreeCalculation } = this.contracts;
    MinaNFTTreeVerifierPlugin.verificationKey = (
      await RedactedMinaNFTTreeCalculation.compile({
        cache,
      })
    ).verificationKey;
    return [];
  }

  public async create(transaction: string): Promise<string | undefined> {
    const {
      RedactedMinaNFTTreeState,
      RedactedMinaNFTTreeCalculation,
      MerkleTreeWitness,
    } = this.contracts;
    if (MinaNFTTreeVerifierPlugin.verificationKey === undefined)
      throw new Error("verificationKey is undefined");
    const args = JSON.parse(transaction);
    const element = TreeElement.fromJSON(args.element);
    const originalWitness = MerkleTreeWitness.fromJSON(args.originalWitness);
    const redactedWitness = MerkleTreeWitness.fromJSON(args.redactedWitness);

    const proof = await RedactedMinaNFTTreeCalculation.create(
      RedactedMinaNFTTreeState.create(
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
      MinaNFTTreeVerifierPlugin.verificationKey
    );
    console.timeEnd("verified proof");
    if (!ok) throw new Error("proof verification failed");
    return JSON.stringify(proof.toJSON(), null, 2);
  }

  public async merge(
    proof1: string,
    proof2: string
  ): Promise<string | undefined> {
    if (MinaNFTTreeVerifierPlugin.verificationKey === undefined)
      throw new Error("verificationKey is undefined");
    const {
      RedactedMinaNFTTreeState,
      RedactedMinaNFTTreeCalculation,
      RedactedMinaNFTTreeStateProof,
    } = this.contracts;

    class TreeStateProof extends RedactedMinaNFTTreeStateProof {}

    const sourceProof1: TreeStateProof = TreeStateProof.fromJSON(
      JSON.parse(proof1) as JsonProof
    );
    const sourceProof2: TreeStateProof = TreeStateProof.fromJSON(
      JSON.parse(proof2) as JsonProof
    );
    const state = RedactedMinaNFTTreeState.merge(
      sourceProof1.publicInput,
      sourceProof2.publicInput
    );
    const proof = await RedactedMinaNFTTreeCalculation.merge(
      state,
      sourceProof1,
      sourceProof2
    );
    console.time("verified proof");
    const ok = await verify(
      proof.toJSON(),
      MinaNFTTreeVerifierPlugin.verificationKey
    );
    console.timeEnd("verified proof");
    if (!ok) throw new Error("proof verification failed");
    return JSON.stringify(proof.toJSON(), null, 2);
  }
}
