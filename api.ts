import { Handler, Context, Callback } from "aws-lambda";
import { mint_v2, mint_v3, post_v3 } from "./src/nft/nft";
import { verifyJWT } from "./src/api/jwt";
import { runSumSequencer } from "./src/api/sum";
import Sequencer from "./src/api/sequencer";
import JobsTable from "./src/table/jobs";
import Names from "./src/table/names";
import { NamesData } from "./src/model/namesData";
import { getBackupPlugin } from "./src/api/plugin";
import { reserveName, indexName } from "./src/api/mint_v3";
import { initLanguages, getLanguage } from "./src/lang/lang";

const BOTAPIAUTH = process.env.BOTAPIAUTH!;
const NAMES_TABLE = process.env.TESTWORLD2_NAMES_TABLE!;

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
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: "Wrong jwtToken",
        });
        return;
      }
      switch (body.command) {
        case "queryBilling":
          const jobsTable = new JobsTable(process.env.JOBS_TABLE!);
          const billingResult = await jobsTable.queryBilling(id);
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body:
              billingResult === undefined
                ? "error"
                : JSON.stringify(billingResult, null, 2) ?? "error",
          });
          return;
          break;

        /*
        case "mint":
          if (body.data.ipfs === undefined) {
            console.error("No IPFS hash");
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: "No IPFS hash",
            });
            return;
          }
          await startDeploymentApi(id, body.data.ipfs);
          break;
        */

        case "lookupName":
          {
            if (
              body.data.transactions === undefined ||
              body.data.developer === undefined ||
              body.data.name === undefined ||
              body.data.task === undefined ||
              body.data.args === undefined ||
              body.data.args.length !== 1
            ) {
              console.error("Wrong lookupName request");
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong lookupName request",
              });
              return;
            }
            const { args } = body.data;
            const names = new Names(NAMES_TABLE);
            const checkName = await names.get({ username: args[0] });
            if (checkName !== undefined) console.log("Found name", checkName);
            else console.log("No name found", args[0]);
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: checkName?.publicKey ?? "error",
            });
          }
          return;

        case "reserveName":
          {
            if (
              body.data.transactions === undefined ||
              body.data.developer === undefined ||
              body.data.name === undefined ||
              body.data.task === undefined ||
              body.data.args === undefined ||
              body.data.args.length !== 2
            ) {
              console.error("Wrong reserveName request");
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong reserveName request",
              });
              return;
            }
            const { args } = body.data;
            const language = await getLanguage(id);
            const result = await reserveName(id, args[0], args[1], language);
            console.log("reserveName result", result);

            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: JSON.stringify(result),
            });
          }
          return;

        case "indexName":
          {
            if (
              body.data.transactions === undefined ||
              body.data.developer === undefined ||
              body.data.name === undefined ||
              body.data.task === undefined ||
              body.data.args === undefined ||
              body.data.args.length !== 1
            ) {
              console.error("Wrong indexName request");
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong indexName request",
              });
              return;
            }
            const { args } = body.data;
            const language = await getLanguage(id);
            const result = await indexName(id, args[0], language);
            console.log("indexName result", result);

            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: JSON.stringify(result),
            });
          }
          return;

        case "mint_v3":
          {
            if (
              body.data.transactions === undefined ||
              body.data.transactions.length !== 1 ||
              body.data.developer === undefined ||
              body.data.name === undefined ||
              body.data.task === undefined ||
              body.data.args === undefined ||
              body.data.args.length !== 3
            ) {
              console.error("Wrong mint data");
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong mint data",
              });
              return;
            }
            const { transactions, developer, name, task, args } = body.data;
            const sequencerTree = new Sequencer({
              jobsTable: process.env.JOBS_TABLE!,
              stepsTable: process.env.STEPS_TABLE!,
              proofsTable: process.env.PROOFS_TABLE!,
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
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: jobIdTask ?? "error",
            });
            if (jobIdTask !== undefined)
              await mint_v3(
                id,
                jobIdTask,
                transactions[0],
                args[0],
                args[1],
                args[2]
              );
          }
          return;

        case "post_v3":
          {
            if (
              body.data.transactions === undefined ||
              body.data.developer === undefined ||
              body.data.name === undefined ||
              body.data.task === undefined ||
              body.data.args === undefined ||
              body.data.args.length !== 6
            ) {
              console.error("Wrong post data");
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong post data",
              });
              return;
            }
            const { transactions, developer, name, task, args } = body.data;
            const sequencerTree = new Sequencer({
              jobsTable: process.env.JOBS_TABLE!,
              stepsTable: process.env.STEPS_TABLE!,
              proofsTable: process.env.PROOFS_TABLE!,
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
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: jobIdTask ?? "error",
            });
            if (jobIdTask !== undefined)
              await post_v3(id, jobIdTask, transactions, args);
          }
          return;

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
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "No transactions data",
              });
              return;
            }
            const { transactions, developer, name, task, args } = body.data;
            try {
              const plugin = await getBackupPlugin({
                developer,
                name,
                task,
                args,
              });
            } catch (error) {
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "error : no such plugin",
              });
              return;
            }
            const sequencerTree = new Sequencer({
              jobsTable: process.env.JOBS_TABLE!,
              stepsTable: process.env.STEPS_TABLE!,
              proofsTable: process.env.PROOFS_TABLE!,
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
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: jobIdTask ?? "error",
            });
            return;
          }
          break;

        case "jobResult":
          if (body.data.jobId === undefined) {
            console.error("No jobId");
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true,
              },
              body: "No jobId",
            });
            return;
          }
          const sequencerResultTree = new Sequencer({
            jobsTable: process.env.JOBS_TABLE!,
            stepsTable: process.env.STEPS_TABLE!,
            proofsTable: process.env.PROOFS_TABLE!,
            username: id,
            jobId: body.data.jobId,
          });
          const jobResultTree = await sequencerResultTree.getJobStatus();
          callback(null, {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
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
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": true,
            },
            body: "Wrong command",
          });
      }

      // await sleep(1000);
    }

    callback(null, {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: "ok",
    });
  } catch (error: any) {
    console.error("bot api catch", error.toString());
    callback(null, {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: "error",
    });
  }
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { botapi };
