import { Handler, Context, Callback } from "aws-lambda";
import callLambda from "./src/mina/lambda";
import BotMessage from "./src/mina/message";
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

            await sleep(1000);
        }

        return 200;
    } catch (error) {
        console.error("bot api catch", (<any>error).toString());
        return 200;
    }
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export { botapi };
