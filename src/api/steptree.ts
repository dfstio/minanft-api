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
  static contracts: any = undefined;
  static height: number = 0;
  static isCompiled: boolean = false;
  static verificationKey: string | undefined = undefined;

  constructor(params: { name: string; task: string; args: string[] }) {
    super(params);
    if (params.args.length !== 1) throw new Error("arguments length not 1");
    const height = Number(params.args[0]);
    if (
      MinaNFTTreeVerifierPlugin.contracts === undefined ||
      height !== MinaNFTTreeVerifierPlugin.height
    ) {
      MinaNFTTreeVerifierPlugin.contracts = MinaNFTTreeVerifierFunction(height);
      MinaNFTTreeVerifierPlugin.isCompiled = false;
      MinaNFTTreeVerifierPlugin.height = height;
    }
  }
  public async compile(cache: Cache): Promise<void> {
    if (MinaNFTTreeVerifierPlugin.isCompiled) return;
    const { RedactedMinaNFTTreeCalculation } =
      MinaNFTTreeVerifierPlugin.contracts;
    MinaNFTTreeVerifierPlugin.verificationKey = (
      await RedactedMinaNFTTreeCalculation.compile({
        cache,
      })
    ).verificationKey;
    MinaNFTTreeVerifierPlugin.isCompiled = true;
  }

  public async create(transaction: string): Promise<string | undefined> {
    const {
      RedactedMinaNFTTreeState,
      RedactedMinaNFTTreeCalculation,
      MerkleTreeWitness,
    } = MinaNFTTreeVerifierPlugin.contracts;
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
    } = MinaNFTTreeVerifierPlugin.contracts;

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
