import { Handler, Context, Callback } from "aws-lambda";
import { startDeploymentApi, mint_v2 } from "./src/nft/nft";
import { verifyJWT } from "./src/api/jwt";
import { runSumSequencer } from "./src/api/sum";

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
