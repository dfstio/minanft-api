import { Handler, Context, Callback } from "aws-lambda";
import BotLogic from "./src/botLogic";
import { rateLimit, initializeRateLimiter } from "./src/api/rate-limit";

initializeRateLimiter({
  name: "send",
  points: 180,
  duration: 60,
});

const send: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  const ip = event?.requestContext?.identity?.sourceIp ?? "no-ip";
  if (
    await rateLimit({
      name: "send",
      key: ip,
    })
  ) {
    console.log("rate limit", ip);
    callback(null, {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: "error: rate limit exceeded",
    });
    return;
  }
  try {
    //console.log("event", event);
    const body = JSON.parse(event.body);
    console.log("Bot request:", ip, body);
    const botLogic = new BotLogic();
    await botLogic.activate(body);
    await sleep(1000);
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
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export { send };
