import Steps from "../table/steps";
import { StepsData } from "../model/stepsData";
import callLambda from "../lambda/lambda";
import { MinaNFTTreeVerifierFunction, Memory, TreeElement } from "minanft";
import { Cache, verify, JsonProof } from "o1js";
import { getCache, listFiles, loadCache } from "../mina/cache";
import { getFileData } from "../storage/filedata";

export async function runStepTree(step: StepsData): Promise<void> {
  console.time("runStepTree");
  Memory.info(`runStepTree start`);
  if (step.stepStatus.toString() !== "created")
    throw new Error("step is not created");
  if (step.arguments.length !== 1) throw new Error("arguments length not 1");
  const height = Number(step.arguments[0]);
  console.log("runStepTree height:", height);

  const StepsTable = new Steps(process.env.STEPS_TABLE!);
  await StepsTable.updateStatus({
    jobId: step.jobId,
    stepId: step.stepId,
    status: "started",
  });

  let result: string = "";
  const cacheDir = "/mnt/efs/cache";
  await listFiles(cacheDir);
  const cache: Cache = Cache.FileSystem(cacheDir);
  const {
    RedactedMinaNFTTreeState,
    RedactedMinaNFTTreeCalculation,
    MinaNFTTreeVerifier,
    MerkleTreeWitness,
    RedactedMinaNFTTreeStateProof,
  } = MinaNFTTreeVerifierFunction(height);

  console.log(`Compiling...`);
  let verificationKey: string = "";
  console.time(`compiled all`);
  console.time(`compiled RedactedTreeCalculation`);
  const { verificationKey: vk } = await RedactedMinaNFTTreeCalculation.compile({
    cache,
  });
  verificationKey = vk;
  console.timeEnd(`compiled RedactedTreeCalculation`);

  console.time(`compiled TreeVerifier`);
  await MinaNFTTreeVerifier.compile({ cache });
  console.timeEnd(`compiled TreeVerifier`);

  console.timeEnd(`compiled all`);
  Memory.info(`compiled`);
  await listFiles(cacheDir);

  console.time("calculated proof");
  if (step.task === "merge") {
    if (step.stepData.length !== 2)
      throw new Error("Input length not 2 for merge");

    console.time(`merged proofs`);
    class TreeStateProof extends RedactedMinaNFTTreeStateProof {}

    const proof1: TreeStateProof = TreeStateProof.fromJSON(
      JSON.parse(step.stepData[0]) as JsonProof
    );
    const proof2: TreeStateProof = TreeStateProof.fromJSON(
      JSON.parse(step.stepData[1]) as JsonProof
    );
    const state = RedactedMinaNFTTreeState.merge(
      proof1.publicInput,
      proof2.publicInput
    );
    const proof = await RedactedMinaNFTTreeCalculation.merge(
      state,
      proof1,
      proof2
    );

    console.timeEnd(`merged proofs`);
    console.time("verify proof");
    const ok = await verify(proof.toJSON(), verificationKey);
    console.timeEnd("verify proof");
    if (!ok) throw new Error("proof verification failed");
    result = JSON.stringify(proof.toJSON(), null, 2);
  } else if (step.task === "create") {
    if (step.stepData.length !== 1)
      throw new Error("Input length not 1 for create");

    const args = JSON.parse(step.stepData[0]);
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
    console.time("verify proof");
    const ok = await verify(proof.toJSON(), verificationKey);
    console.timeEnd("verify proof");
    if (!ok) throw new Error("proof verification failed");
    result = JSON.stringify(proof.toJSON(), null, 2);
  } else throw new Error("unknown task");
  console.timeEnd("calculated proof");
  Memory.info(`calculated proof`);

  await StepsTable.updateStatus({
    jobId: step.jobId,
    stepId: step.stepId,
    status: "finished",
    result: result,
  });

  await callLambda(
    "sequencer",
    JSON.stringify({ task: "run", username: step.username, jobId: step.jobId })
  );
  console.timeEnd("runStepTree");
}
