import { Handler, Context, Callback } from "aws-lambda";
import { startDeploymentApi, mint_v2 } from "./src/nft/nft";
import { verifyJWT } from "./src/api/jwt";
import { runSumSequencer } from "./src/api/sum";
import Sequencer from "./src/api/sequencer";

const BOTAPIAUTH = process.env.BOTAPIAUTH!;

const botapi: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.log("event", event.body);
    const body = JSON.parse(event.body);
    if (
      body &&
      body.auth &&
      body.auth === BOTAPIAUTH &&
      body.command &&
      body.data &&
      body.jwtToken
    ) {
      const id: string | undefined = verifyJWT(body.jwtToken);
      if (id === undefined) {
        console.error("Wrong jwtToken");
        callback(null, {
          statusCode: 200,
          body: "Wrong jwtToken",
        });
        return;
      }
      switch (body.command) {
        case "mint":
          if (body.data.ipfs === undefined) {
            console.error("No IPFS hash");
            callback(null, {
              statusCode: 200,
              body: "No IPFS hash",
            });
            return;
          }
          await startDeploymentApi(id, body.data.ipfs);
          break;

        case "proof":
          {
            if (
              body.data.transactions === undefined ||
              body.data.developer === undefined ||
              body.data.name === undefined ||
              body.data.task === undefined ||
              body.data.args === undefined
            ) {
              console.error("Wrong proof command", body.data);
              callback(null, {
                statusCode: 200,
                body: "No transactions data",
              });
              return;
            }
            const { transactions, developer, name, task, args } = body.data;
            const sequencerTree = new Sequencer({
              jobsTable: process.env.JOBS_TABLE!,
              stepsTable: process.env.STEPS_TABLE!,
              username: id,
            });
            const jobIdTask = await sequencerTree.createJob({
              username: id,
              developer,
              name,
              jobData: transactions,
              task,
              args,
            });
            callback(null, {
              statusCode: 200,
              body: jobIdTask ?? "error",
            });
            return;
          }
          break;

        case "proofResult":
          if (body.data.jobId === undefined) {
            console.error("No jobId");
            callback(null, {
              statusCode: 200,
              body: "No jobId",
            });
            return;
          }
          const sequencerResultTree = new Sequencer({
            jobsTable: process.env.JOBS_TABLE!,
            stepsTable: process.env.STEPS_TABLE!,
            username: id,
            jobId: body.data.jobId,
          });
          const jobResultTree = await sequencerResultTree.getJobStatus();
          callback(null, {
            statusCode: 200,
            body: JSON.stringify(jobResultTree, null, 2) ?? "error",
          });
          return;
          break;
        /*
        case "mint_v2":
          if (body.data.uri === undefined) {
            console.error("No URI data");
            callback(null, {
              statusCode: 200,
              body: "No URI data",
            });
            return;
          }
          await mint_v2(id, body.data.uri, body.data.privateKey);
          break;

        case "sum":
          if (body.data.transactions === undefined) {
            console.error("No transactions data");
            callback(null, {
              statusCode: 200,
              body: "No transactions data",
            });
            return;
          }
          const sum = await runSumSequencer(body.data.transactions);
          callback(null, {
            statusCode: 200,
            body: sum,
          });
          return;
          break;

        case "sum_v2":
          if (body.data.transactions === undefined) {
            console.error("No transactions data");
            callback(null, {
              statusCode: 200,
              body: "No transactions data",
            });
            return;
          }
          const sequencer = new Sequencer({
            jobsTable: process.env.JOBS_TABLE!,
            stepsTable: process.env.STEPS_TABLE!,
            username: id,
          });
          const jobId = await sequencer.createJob({
            username: id,
            name: "sum",
            task: "sum",
            args: [],
            jobData: body.data.transactions,
          });
          callback(null, {
            statusCode: 200,
            body: jobId ?? "error",
          });
          return;
          break;

        case "sum_v2_result":
          if (body.data.jobId === undefined) {
            console.error("No jobId");
            callback(null, {
              statusCode: 200,
              body: "No jobId",
            });
            return;
          }
          const sequencerResult = new Sequencer({
            jobsTable: process.env.JOBS_TABLE!,
            stepsTable: process.env.STEPS_TABLE!,
            username: id,
            jobId: body.data.jobId,
          });
          const jobResult = await sequencerResult.getJobStatus();
          callback(null, {
            statusCode: 200,
            body: JSON.stringify(jobResult, null, 2) ?? "error",
          });
          return;
          break;

        case "tree":
          if (body.data.transactions === undefined) {
            console.error("No transactions data");
            callback(null, {
              statusCode: 200,
              body: "No transactions data",
            });
            return;
          }
          const sequencerTree = new Sequencer({
            jobsTable: process.env.JOBS_TABLE!,
            stepsTable: process.env.STEPS_TABLE!,
            username: id,
          });
          const jobIdTask = await sequencerTree.createJob({
            username: id,
            name: "tree",
            jobData: body.data.transactions,
            task: body.data.task,
            arguments: body.data.arguments,
          });
          callback(null, {
            statusCode: 200,
            body: jobIdTask ?? "error",
          });
          return;
          break;

        case "tree_result":
          if (body.data.jobId === undefined) {
            console.error("No jobId");
            callback(null, {
              statusCode: 200,
              body: "No jobId",
            });
            return;
          }
          const sequencerResultTree = new Sequencer({
            jobsTable: process.env.JOBS_TABLE!,
            stepsTable: process.env.STEPS_TABLE!,
            username: id,
            jobId: body.data.jobId,
          });
          const jobResultTree = await sequencerResultTree.getJobStatus();
          callback(null, {
            statusCode: 200,
            body: JSON.stringify(jobResultTree, null, 2) ?? "error",
          });
          return;
          break;
*/
        default:
          console.error("Wrong command");
          callback(null, {
            statusCode: 200,
            body: "Wrong command",
          });
      }

      // await sleep(1000);
    }

    callback(null, {
      statusCode: 200,
      body: "ok",
    });
  } catch (error: any) {
    console.error("bot api catch", error.toString());
    callback(null, {
      statusCode: 200,
      body: "error",
    });
  }
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { botapi };
