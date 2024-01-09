import { Handler, Context, Callback } from "aws-lambda";
import ChatGPTMessage from "./src/chatgpt/chatgpt";
import ImageGPT from "./src/model/imageGPT";
import BotMessage from "./src/mina/message";
import { getT, initLanguages, getLanguage } from "./src/lang/lang";
import { context as contextChatGPT } from "./src/chatgpt/context";
import { getAIfunctions } from "./src/chatgpt/functions";
import { BotMintData } from "./src/model/namesData";
import { startDeployment, generateFilename } from "./src/nft/nft";
import { copyAIImageToS3 } from "./src/imageHandler";
import { FileData } from "./src/model/fileData";
import { FilesTable } from "./src/table/files";
import HistoryTable from "./src/table/history";
import { getFormattedDateTime } from "./src/nft/nft";
import callLambda from "./src/lambda/lambda";

const FILES_TABLE = process.env.FILES_TABLE!;
const HISTORY_TABLE = process.env.HISTORY_TABLE!;

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;

const chatgpt: Handler = async (
  event: any,
  context: Context,
  callback: Callback
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
          await getAIfunctions(event.id)
        );
        result = await chat.message(event);
      }

      const bot = new BotMessage(event.id, language);
      if (result.answerType === "text") {
        if (result.text.length < 4000) await bot.message(result.text, false);
        else {
          const str = result.text.match(/.{1,4000}/g);
          if (str) {
            console.log("Length", str.length);
            let i;
            for (i = 0; i < str.length; i++) {
              await bot.message(str[i], false);
              await sleep(2000);
            }
          } else console.error("match error");
        }
        /*
        if (result.text.length < 4000 * 2) {
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
        */
      }
      if (result.answerType === "image")
        await bot.image(result.image, result.text);

      console.log(
        "ChatGPT result answerType:",
        result.answerType,
        "text",
        result.text
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
  callback: Callback
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
      if (event.message && event.id) {
        await initLanguages();
        const language = await getLanguage(event.id);
        const chat = new ChatGPTMessage(
          CHATGPT_TOKEN,
          language,
          contextChatGPT
        );
        result = await chat.image(
          event.message,
          event.id,
          //event.username,
          false,
          event.ai === "true" ? true : false
        );
      }
      console.log("Image result", result);
      if (event.id && result.image !== "") {
        await initLanguages();
        const language = await getLanguage(event.id);
        const T = getT(language);
        const timeNow = Date.now();
        //const filename = generateFilename(timeNow) + ".jpg";
        const filename = "image." + getFormattedDateTime(timeNow) + ".jpg";
        const file = await copyAIImageToS3(
          event.id,
          filename,
          result.image,
          true
        );
        if (file === undefined) {
          console.error("Image is undefined");
          return;
        }
        const fileTable = new FilesTable(FILES_TABLE);
        await fileTable.create(file);
        if (event.ai !== "true") {
          await startDeployment({
            id: event.id,
            language,
            timeNow,
            filename,
            username: event.username,
            creator: event.creator,
          } as BotMintData);
        } else {
          const history = new HistoryTable(HISTORY_TABLE, event.id);
          await history.add(
            T("image.generated", { filedata: JSON.stringify(file) }),
            false
          );
          const bot = new BotMessage(event.id, language);
          await callLambda(
            "ask",
            JSON.stringify({
              id: event.id,
              message: "photo is generated",
              parentMessage: "",
              image: "",
              auth: CHATGPTPLUGINAUTH,
            })
          );
          //const image = `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/${filename}`;
          const image = `https://minanft-storage.s3.eu-west-1.amazonaws.com/${event.id}/${filename}`;
          await bot.image(image, {});
        }
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
  callback: Callback
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
    const language = event.id ? await getLanguage(event.id) : "en";
    if (event && event.auth && event.auth === CHATGPTPLUGINAUTH) {
      if (event.message && event.id && event.username) {
        const chat = new ChatGPTMessage(
          CHATGPT_TOKEN,
          language,
          contextChatGPT
        );
        result = await chat.image(
          event.message,
          event.id,
          event.username,
          true
        );
      }
      console.log("Image result", result);
      if (event.id && event.username && result.image !== "") {
        const bot = new BotMessage(event.id, language);
        await bot.image(result.image, "ArchetypeNFT");
        await bot.message(result.text);
        const timeNow = Date.now();
        const filename = generateFilename(timeNow) + ".jpg";
        await copyAIImageToS3(event.id, filename, result.image);
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
