import { Handler, Context, Callback } from "aws-lambda";
import { verifyJWT } from "./src/api/jwt";
import Sequencer from "./src/api/sequencer";
import JobsTable from "./src/table/jobs";
import Jobs from "./src/table/jobs";
import callLambda from "./src/lambda/lambda";
import { zkCloudWorkerDeploy, zkCloudWorkerRun } from "./src/api/zkcloudworker";

const ZKCLOUDWORKER_AUTH = process.env.ZKCLOUDWORKER_AUTH!;

const api: Handler = async (
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
      body.auth === ZKCLOUDWORKER_AUTH &&
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

        case "deploy":
          {
            if (body.data.packageName === undefined) {
              console.error("Wrong deploy command", body.data);
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong deploy command",
              });
              return;
            }
            const { packageName } = body.data;

            const jobIdTask = await createJob({
              command: "deploy",
              username: id,
              developer: "@dfst",
              name: packageName,
              jobData: [],
              task: "deploy",
              args: [],
              jobsTable: process.env.JOBS_TABLE!,
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

        case "createJob":
          {
            if (
              body.data.transactions === undefined ||
              body.data.developer === undefined ||
              body.data.name === undefined ||
              body.data.task === undefined ||
              body.data.args === undefined
            ) {
              console.error("Wrong createJob command", body.data);
              callback(null, {
                statusCode: 200,
                headers: {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Credentials": true,
                },
                body: "Wrong createJob command",
              });
              return;
            }
            const { transactions, developer, name, task, args } = body.data;

            const jobIdTask = await createJob({
              command: "createJob",
              username: id,
              developer,
              name,
              jobData: transactions,
              task,
              args,
              jobsTable: process.env.JOBS_TABLE!,
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

const worker: Handler = async (event: any, context: Context) => {
  let success = false;
  try {
    console.log("worker", event);
    if (event.username && event.jobId && event.command && event.name) {
      if (event.command === "deploy") {
        await zkCloudWorkerDeploy({
          name: event.name,
          username: event.username,
          jobId: event.jobId,
        });
        success = true;
      } else if (event.command === "createJob") {
        await zkCloudWorkerRun({
          name: event.name,
          username: event.username,
          jobId: event.jobId,
        });
        success = true;
      } else console.error("worker: unknown command");
      if (success === false) {
        console.error("worker: failed");
        const JobsTable = new Jobs(process.env.JOBS_TABLE!);
        await JobsTable.updateStatus({
          username: event.username,
          jobId: event.jobId,
          status: "failed",
          result: "worker: unknown command",
          billedDuration: 0,
        });
      }
    } else console.error("worker: Wrong event format");

    return {
      statusCode: 200,
      body: "ok",
    };
  } catch (error) {
    console.error("worker: catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "worker run error",
    };
  }
};

async function createJob(params: {
  command: string;
  username: string;
  developer: string;
  name: string;
  jobData: string[];
  task: string;
  args: string[];
  jobsTable: string;
}): Promise<string | undefined> {
  const { command, username, developer, name, jobData, task, args, jobsTable } =
    params;
  const JobsTable = new Jobs(jobsTable);
  const jobId = await JobsTable.createJob({
    username,
    developer,
    jobName: name,
    jobData,
    task,
    args,
  });
  await callLambda(
    "worker",
    JSON.stringify({ command, username, jobId, name })
  );
  return jobId;
}

export { worker, api };
