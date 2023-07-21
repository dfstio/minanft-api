import { Handler, Context, Callback } from "aws-lambda";
import ChatGPTMessage from "./src/chatgpt/chatgpt";
import callLambda from "./src/mina/lambda";
import ImageGPT from "./src/model/imageGPT";
import BotMessage from "./src/mina/message";
import { context as contextChatGPT } from "./src/chatgpt/context";
import NamesData from "./src/model/namesData";
import { startDeployment, generateFilename } from "./src/nft/nft";
import { copyAIImageToS3 } from "./src/imageHandler";

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;

const chatgpt: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  try {
    //console.log("event", event);
    //const body = JSON.parse(event.body);
    console.log("ChatGPT ask request:", event);
    let result: ImageGPT = <ImageGPT>{
      image: "",
      answerType: "text",
      text: "Authentification failed",
    };
    if (event && event.auth && event.auth === CHATGPTPLUGINAUTH) {
      const chat = new ChatGPTMessage(CHATGPT_TOKEN, contextChatGPT);
      if (event.message && event.id)
        result = await chat.message(
          event.message,
          event.parentMessage,
          event.id,
          event.image,
        );
      if (event.id) {
        const bot = new BotMessage(event.id);
        if (result.answerType === "text") await bot.message(result.text);
        if (result.answerType === "image")
          await bot.image(result.image, result.text);
      }

      console.log("ChatGPT ask reply:", result.answerType, result.text);
      await sleep(1000);
    }

    return 200;
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return 200;
  }
};

const image: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  try {
    //console.log("event", event);
    //const body = JSON.parse(event.body);
    console.log("ChatGPT ask request:", event);
    let result: ImageGPT = <ImageGPT>{
      image: "",
      answerType: "text",
      text: "Authentification failed",
    };
    if (event && event.auth && event.auth === CHATGPTPLUGINAUTH) {
      const chat = new ChatGPTMessage(CHATGPT_TOKEN, contextChatGPT);

      if (event.message && event.id && event.username)
        result = await chat.image(
          event.message,
          event.parentMessage,
          event.id,
          event.username,
        );
      console.log("Image result", result);
      if (event.id && event.username && result.image !== "") {
        const timeNow = Date.now();
        const filename = generateFilename(timeNow) + ".jpg";
        await copyAIImageToS3(filename, result.image);
        await startDeployment(event.id, timeNow, filename, event.username);
      }
    }

    console.log("ChatGPT ask reply:", result.answerType, result.text);
    await sleep(1000);
    //}

    return 200;
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return 200;
  }
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { chatgpt, image };
