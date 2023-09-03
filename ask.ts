import { Handler, Context, Callback } from "aws-lambda";
import { ChatCompletionFunctions } from "openai";
import ChatGPTMessage from "./src/chatgpt/chatgpt";
import callLambda from "./src/mina/lambda";
import ImageGPT from "./src/model/imageGPT";
import BotMessage from "./src/mina/message";
import { context as contextChatGPT } from "./src/chatgpt/context";
import { functions } from "./src/chatgpt/functions";
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
      if (event.message && event.id) {
        const chat = new ChatGPTMessage(
          CHATGPT_TOKEN,
          contextChatGPT,
          functions,
        );
        result = await chat.message(event);
      }
      if (event.id) {
        const bot = new BotMessage(event.id);
        if (result.answerType === "text") {
          if (result.text.length < 4000) await bot.message(result.text);
          else if (result.text.length < 4000 * 2) {
            await bot.message(result.text.substring(0, 4000));
            await sleep(1000);
            await bot.message(result.text.substring(4000, 4000 * 2));
          } else {
            await bot.message(result.text.substring(0, 4000));
            await sleep(1000);
            await bot.message(result.text.substring(4000, 4000 * 2));
            await sleep(1000);
            await bot.message(result.text.substring(4000 * 2, 4000 * 3));
          }
        }
        if (result.answerType === "image")
          await bot.image(result.image, result.text);
      }

      console.log(
        "ChatGPT result answerType:",
        result.answerType,
        "text",
        result.text,
      );
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
    console.log("ChatGPT ask request:", event);
    let result: ImageGPT = <ImageGPT>{
      image: "",
      answerType: "text",
      text: "Authentification failed",
    };
    if (event && event.auth && event.auth === CHATGPTPLUGINAUTH) {
      if (event.message && event.id && event.username) {
        const chat = new ChatGPTMessage(CHATGPT_TOKEN, contextChatGPT);
        result = await chat.image(
          event.message,
          event.parentMessage,
          event.id,
          event.username,
        );
      }
      console.log("Image result", result);
      if (event.id && event.username && result.image !== "") {
        const timeNow = Date.now();
        const filename = generateFilename(timeNow) + ".jpg";
        await copyAIImageToS3(filename, result.image);
        await startDeployment(
          event.id,
          timeNow,
          filename,
          event.username,
          event.creator,
        );
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

const archetype: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  try {
    //console.log("event", event);
    console.log("ChatGPT ask archetype request:", event);
    let result: ImageGPT = <ImageGPT>{
      image: "",
      answerType: "text",
      text: "Authentification failed",
    };
    if (event && event.auth && event.auth === CHATGPTPLUGINAUTH) {
      if (event.message && event.id && event.username) {
        const chat = new ChatGPTMessage(CHATGPT_TOKEN, contextChatGPT);
        result = await chat.image(
          event.message,
          "",
          event.id,
          event.username,
          true,
        );
      }
      console.log("Image result", result);
      if (event.id && event.username && result.image !== "") {
        const bot = new BotMessage(event.id);
        await bot.image(result.image, "ArchetypeNFT");
        await bot.message(result.text);
        const timeNow = Date.now();
        const filename = generateFilename(timeNow) + ".jpg";
        await copyAIImageToS3(filename, result.image);
        await bot.message(
          "Please run the Midjourney /imagine command using the prompt above to generate your NFT image",
        );
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

export { chatgpt, image, archetype };
