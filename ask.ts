import { Handler, Context, Callback } from "aws-lambda";
import ChatGPTMessage from "./src/chatgpt/chatgpt";
import ImageGPT from "./src/model/imageGPT";
import BotMessage from "./src/mina/message";
import { initLanguages, getLanguage } from './src/lang/lang'
import { context as contextChatGPT } from "./src/chatgpt/context";
import { functions } from "./src/chatgpt/functions";
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

    if (event && event.auth && event.id && event.auth === CHATGPTPLUGINAUTH) {
      await initLanguages();
      const language = await getLanguage(event.id);
      if (event.message) {
        const chat = new ChatGPTMessage(
          CHATGPT_TOKEN,
          language,
          contextChatGPT,
          functions,
        );
        result = await chat.message(event);
      }

      const bot = new BotMessage(event.id, language);
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
        await initLanguages();
        const language = await getLanguage(event.id);
        const chat = new ChatGPTMessage(CHATGPT_TOKEN, language, contextChatGPT);
        result = await chat.image(
          event.message,
          event.id,
          event.username,
        );
      }
      console.log("Image result", result);
      if (event.id && event.username && result.image !== "") {
        await initLanguages();
        const language = await getLanguage(event.id);
        const timeNow = Date.now();
        const filename = generateFilename(timeNow) + ".jpg";
        await copyAIImageToS3(filename, result.image);
        await startDeployment(
          event.id,
          language,
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
    await initLanguages();
    const language = event.id ? await getLanguage(event.id) : 'en'
    if (event && event.auth && event.auth === CHATGPTPLUGINAUTH) {
      if (event.message && event.id && event.username) {
        const chat = new ChatGPTMessage(CHATGPT_TOKEN, language, contextChatGPT);
        result = await chat.image(
          event.message,
          event.id,
          event.username,
          true,
        );
      }
      console.log("Image result", result);
      if (event.id && event.username && result.image !== "") {
        const bot = new BotMessage(event.id, language);
        await bot.image(result.image, "ArchetypeNFT");
        await bot.message(result.text);
        const timeNow = Date.now();
        const filename = generateFilename(timeNow) + ".jpg";
        await copyAIImageToS3(filename, result.image);
        await bot.tmessage("midjourney");
      }
    }

    console.log("ChatGPT ask reply:", result.answerType, result.text);
    await sleep(1000);

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
