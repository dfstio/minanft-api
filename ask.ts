import { Handler, Context, Callback } from "aws-lambda";
import ChatGPTMessage from "./src/chatgpt/chatgpt";
import ImageGPT from "./src/model/imageGPT";
import BotMessage from "./src/chatgpt/message";
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
import { splitMarkdown } from "./src/chatgpt/split";
import Users from "./src/table/users";
import axios from "axios";
import { MAX_IMAGES, MAX_TOKENS } from "./src/model/userData";

const FILES_TABLE = process.env.FILES_TABLE!;
const HISTORY_TABLE = process.env.HISTORY_TABLE!;

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;

const LIMIT_MESSAGE =
  "You have reached the limit of bot use. To increase the limit, send 10 MINA to B62qqRwyFetYpTRbFYtKTTJBYEgErzsuFZL2JWoG7PEHrkYtibLsRT8 and then send your name and payment transaction hash to support@minanft.io";

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
      const users = new Users(process.env.DYNAMODB_TABLE!);
      const user = await users.getItem(event.id);
      if (user === undefined) {
        console.error("User not found");
        return 200;
      }
      let allowed_images = MAX_IMAGES;
      if (user.allowed_images !== undefined)
        allowed_images = user.allowed_images;
      let allowed_tokens = MAX_TOKENS;
      if (user.allowed_tokens !== undefined)
        allowed_tokens = user.allowed_tokens;
      if (user.images_created === undefined) user.images_created = 0;
      if (user.total_tokens === undefined) user.total_tokens = 0;
      if (
        user.images_created >= allowed_images ||
        user.total_tokens >= allowed_tokens
      ) {
        console.error("ask: User reached the limit", {
          id: user.id,
          username: user.username,

          allowed_images,
          allowed_tokens,
          images_created: user.images_created,
          total_tokens: user.total_tokens,
          user,
        });
        const bot = new BotMessage(event.id, language);
        await sleep(1000);
        await bot.message(LIMIT_MESSAGE);
        await sleep(1000);
        return 200;
      }
      const chat = new ChatGPTMessage(
        CHATGPT_TOKEN,
        language,
        contextChatGPT,
        await getAIfunctions(event.id)
      );
      result = await chat.message(event.id);

      const bot = new BotMessage(event.id, language);
      if (result.answerType === "text") {
        if (result.text.length < 4000) await bot.message(result.text, false);
        else {
          const parts = splitMarkdown(result.text);
          for (const part of parts) {
            await bot.message(part, false);
            await sleep(2000);
          }
        }
      }
      if (result.answerType === "image")
        console.error("Image is not supported in this version");

      console.log("ChatGPT result:", result);
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
        const users = new Users(process.env.DYNAMODB_TABLE!);
        const user = await users.getItem(event.id);
        if (user === undefined) {
          console.error("User not found");
          return 200;
        }
        let allowed_images = MAX_IMAGES;
        if (user.allowed_images !== undefined)
          allowed_images = user.allowed_images;
        let allowed_tokens = MAX_TOKENS;
        if (user.allowed_tokens !== undefined)
          allowed_tokens = user.allowed_tokens;
        if (user.images_created === undefined) user.images_created = 0;
        if (user.total_tokens === undefined) user.total_tokens = 0;
        if (
          user.images_created >= allowed_images ||
          user.total_tokens >= allowed_tokens
        ) {
          console.error("image: User reached the limit", {
            id: user.id,
            username: user.username,

            allowed_images,
            allowed_tokens,
            images_created: user.images_created,
            total_tokens: user.total_tokens,
            user,
          });
          const bot = new BotMessage(event.id, language);
          await sleep(1000);
          await bot.message(LIMIT_MESSAGE);

          await sleep(1000);
          return 200;
        }
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
        const filename = "image-" + timeNow + ".png";
        const file = await copyAIImageToS3({
          id: event.id,
          filename,
          url: result.image,
          ai: true,
        });
        if (file === undefined) {
          console.error("Image is undefined");
          return 200;
        }
        const fileTable = new FilesTable(FILES_TABLE);
        await fileTable.create(file);

        const history = new HistoryTable(HISTORY_TABLE, event.id);

        const urlBase = process.env.STORAGE_URL;
        if (!urlBase) throw new Error("STORAGE_URL is not defined");
        const url = urlBase + event.id + "/" + filename;
        const image = `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${url}`;
        console.log("Image URL", url);
        axios
          .get(image, {
            responseType: "arraybuffer",
          })
          .then((response: any) => {
            console.log("cloudinary ping - ai");
          })
          .catch((e: any) => console.error("cloudinary ping error - ai", e));

        await history.addImage(
          `image is generated by and received the user, file: ${JSON.stringify(
            file
          )}`,
          image
        );
        const bot = new BotMessage(event.id, language);
        await bot.image(url, {});
        await sleep(1000);
        await callLambda(
          "ask",
          JSON.stringify({
            id: event.id,
            auth: CHATGPTPLUGINAUTH,
          })
        );
      } else if (event.id && result.image === "") {
        await initLanguages();
        const language = await getLanguage(event.id);
        const T = getT(language);
        const history = new HistoryTable(HISTORY_TABLE, event.id);

        await history.add(
          T("image.not.generated", { message: result.text }),
          false
        );
        await callLambda(
          "ask",
          JSON.stringify({
            id: event.id,
            auth: CHATGPTPLUGINAUTH,
          })
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

export { chatgpt, image };
