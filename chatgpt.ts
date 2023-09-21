/*
import { Handler, Context, Callback } from "aws-lambda";
import ChatGPTplugin from "./src/chatgpt/plugin";

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;

const plugin: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  try {
    console.log("event", event);
    //const body = JSON.parse(event.body);
    console.log("ChatGPT request to plugin:", event);
    let result: string = "Authentification failed";
    if (event && event.auth && event.auth === CHATGPTPLUGINAUTH) {
      const plugin = new ChatGPTplugin(CHATGPT_TOKEN);
      result = await plugin.activate(event);
    }

    callback(null, {
      statusCode: 200,
      body: result,
    });
  } catch (error) {
    console.error("catch", (<any>error).toString());
    callback(null, {
      statusCode: 200,
      body: "Nulla osta ChatGPT plugin error, please try again later",
    });
  }
};

export { plugin };
*/
