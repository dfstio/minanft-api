import { Handler, Context, Callback } from "aws-lambda";
import BotLogic from "./src/botLogic";

const send: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  try {
    //console.log("event", event);
    const body = JSON.parse(event.body);
    console.log("Bot request:", body);
    const botLogic = new BotLogic();
    await botLogic.activate(body);

    callback(null, {
      statusCode: 200,
      body: "ok",
    });
  } catch (error) {
    console.error("catch", (<any>error).toString());
    callback(null, {
      statusCode: 200,
      body: "ok",
    });
  }
};

export { send };
