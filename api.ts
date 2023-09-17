import { Handler, Context, Callback } from "aws-lambda";
import { startDeploymentApi } from "./src/nft/nft";

const BOTAPIAUTH = process.env.BOTAPIAUTH!;

const botapi: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  try {
    console.log("event", event.body);
    const body = JSON.parse(event.body);
    if (
      body &&
      body.auth &&
      body.auth === BOTAPIAUTH &&
      body.command &&
      body.data
    ) {
      switch (body.command) {
        case "mint":
          await startDeploymentApi(body.data);
          break;
        default:
          console.error("Wrong command");
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
      body: error.toString(),
    });
  }
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { botapi };
