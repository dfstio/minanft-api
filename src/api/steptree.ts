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
  static treeCalculationVerificationKey: string | undefined = undefined;
  static treeVerifierVerificationKey: VerificationKey | undefined = undefined;

  constructor(params: { name: string; task: string; args: string[] }) {
    super(params);
    if (params.args.length !== 1) throw new Error("arguments length not 1");
    const height = Number(params.args[0]);
    this.contracts = MinaNFTTreeVerifierFunction(height);
  }
  public async compile(cache: Cache): Promise<VerificationKey[] | undefined> {
    const { RedactedMinaNFTTreeCalculation, MinaNFTTreeVerifier } =
      this.contracts;
    console.time(`compiled RedactedTreeCalculation`);
    const { verificationKeyCalculation } =
      await RedactedMinaNFTTreeCalculation.compile({
        cache,
      });
    MinaNFTTreeVerifierPlugin.treeCalculationVerificationKey =
      verificationKeyCalculation;
    console.timeEnd(`compiled RedactedTreeCalculation`);

    console.time(`compiled TreeVerifier`);
    const { verificationKey } = await MinaNFTTreeVerifier.compile({ cache });
    MinaNFTTreeVerifierPlugin.treeVerifierVerificationKey = verificationKey;
    console.timeEnd(`compiled TreeVerifier`);
    return [verificationKey];
  }

  public async create(transaction: string): Promise<string | undefined> {
    const {
      RedactedMinaNFTTreeState,
      RedactedMinaNFTTreeCalculation,
      MinaNFTTreeVerifier,
      MerkleTreeWitness,
      RedactedMinaNFTTreeStateProof,
    } = this.contracts;
    if (MinaNFTTreeVerifierPlugin.treeCalculationVerificationKey === undefined)
      throw new Error("treeCalculationVerificationKey is undefined");
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
      MinaNFTTreeVerifierPlugin.treeCalculationVerificationKey
    );
    console.timeEnd("verified proof");
    if (!ok) throw new Error("proof verification failed");
    return JSON.stringify(proof.toJSON(), null, 2);
  }

  public async merge(
    proof1: string,
    proof2: string
  ): Promise<string | undefined> {
    if (MinaNFTTreeVerifierPlugin.treeCalculationVerificationKey === undefined)
      throw new Error("treeCalculationVerificationKey is undefined");
    const {
      RedactedMinaNFTTreeState,
      RedactedMinaNFTTreeCalculation,
      MinaNFTTreeVerifier,
      MerkleTreeWitness,
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
      MinaNFTTreeVerifierPlugin.treeCalculationVerificationKey
    );
    console.timeEnd("verified proof");
    if (!ok) throw new Error("proof verification failed");
    return JSON.stringify(proof.toJSON(), null, 2);
  }
}
