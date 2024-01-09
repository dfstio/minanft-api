/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Telegraf, Context } from "telegraf";
import Questions from "./questions";
import { getT, initLanguages, getVoice, setVoice } from "./lang/lang";
import Users from "./table/users";
import Names from "./table/names";
import History from "./table/history";
import {
  startDeployment,
  generateFilename,
  getFormattedDateTime,
} from "./nft/nft";
import { BotMintData } from "./model/namesData";
import DocumentData from "./model/documentData";
import FileHandler from "./fileHandler";
import VoiceData from "./model/voiceData";
import { copyTelegramImageToS3 } from "./imageHandler";
import VoiceHandler from "./voiceHandler";
import Validator from "./validator";
import FormQuestion from "./model/formQuestion";
import callLambda from "./lambda/lambda";
import { reservedNames } from "./nft/reservednames";
import { generateJWT } from "./api/jwt";
import { algoliaWriteTokens } from "./nft/algolia";
import {
  supportTicket,
  botCommandList,
  botCommandBuy,
  botCommandCallback,
} from "./payments/botcommands";
import UserData from "./model/userData";
import { FileData } from "./model/fileData";
import { FilesTable } from "./table/files";

const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;
const NAMES_TABLE = process.env.TESTWORLD2_NAMES_TABLE!;
const HISTORY_TABLE = process.env.HISTORY_TABLE!;
const FILES_TABLE = process.env.FILES_TABLE!;
const LANG = process.env.LANG ? process.env.LANG : "en";
console.log("Language", LANG);

interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

interface ReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

export default class BotLogic {
  bot: Telegraf<Context>;
  id: string | undefined;
  supportId: string;
  history: History | undefined;
  //chat: ChatGPTMessage;
  users: Users;
  validator: Validator;
  questions: Questions;

  constructor(
    token: string = process.env.BOT_TOKEN!,
    supportId: string = process.env.SUPPORT_CHAT!
  ) {
    this.bot = new Telegraf(token);
    this.supportId = supportId;
    this.bot.on("callback_query", async (ctx: any) => {
      await botCommandCallback(ctx);
    });
    this.bot.hears("name", async (ctx: any) => {
      return await ctx.reply("MinaNFT");
    });
    this.bot.hears("link", async (ctx: any) => {
      return await ctx.reply("https://minanft.io");
    });
    this.bot.hears("Name", (ctx: any) => ctx.reply("MinaNFT"));
    this.bot.hears("Link", (ctx: any) => ctx.reply("https://minanft.io"));
    this.bot.on("message", async (ctx) => {
      return await this.handleMessage(ctx);
    });
    this.bot.on("pre_checkout_query", async (ctx) => {
      return await this.handleMessage(ctx);
    });
    this.bot.catch((err, ctx: any) => {
      console.error(`Telegraf error for ${ctx.updateType}`, err);
    });
    //this.chat = new ChatGPTMessage(CHATGPT_TOKEN, context, functions);
    this.questions = new Questions();
    this.users = new Users(process.env.DYNAMODB_TABLE!);
    this.validator = new Validator();
    this.id = undefined;
  }

  public async activate(body: any) {
    return await this.bot.handleUpdate(body);
  }

  public async message(msg: string, logHistory = true): Promise<void> {
    if (this.id) {
      this.bot.telegram.sendMessage(this.id, msg).catch((error) => {
        console.error("Telegraf error", error);
      });
      if (this.history != null && logHistory)
        await this.history.add(msg, false);
    } else console.error("No id for message:", msg);

    if (logHistory) {
      const supportMsg: string = `Message for ${this.id}: ${msg}`;
      this.bot.telegram
        .sendMessage(this.supportId, supportMsg)
        .catch((error) => {
          console.error("Telegraf error", error);
        });
      console.log(supportMsg);
    }
  }

  public async handleMessage(body: any): Promise<void> {
    console.log("handleMessage", body);
    if (body.update?.pre_checkout_query) {
      console.log("pre_checkout_query", body);
      this.bot.telegram
        .answerPreCheckoutQuery(
          body.update.pre_checkout_query.id,
          true,
          "Please try again to pay"
        )
        .catch((error) => {
          console.error("Telegraf error", error);
        });
      return;
    }

    const formQuestions = this.questions.questions;
    const chatId = body.message && body.message.chat && body.message.chat.id;

    let username =
      body.message && body.message.from && body.message.from.username;
    let userInput: string | undefined = body.message && body.message.text;
    const command = userInput ? userInput.toLowerCase() : "";
    if (!username) username = "";
    if (!chatId) {
      console.log("No message", body);
      return;
    }
    const chatIdString: string = chatId.toString();
    this.id = chatIdString;
    this.history = new History(HISTORY_TABLE, chatIdString);
    if (userInput) await this.history.add(userInput, true);

    if (body.message && body.message.successful_payment) {
      console.log("successful_payment");
      await this.message("Thank you for payment"); //TODO: translate message and handle payment
      return;
    }

    if (chatId == process.env.SUPPORT_CHAT) {
      console.log("Support message", body);
      // TODO: If message === "approve" then call lambda to add verifier's signature to the smart contract
      if (body.message && body.message.reply_to_message) {
        const reply = body.message.reply_to_message;
        console.log("Support reply", reply);
        const replyChat = parseInt(reply.text.split("\n")[0]);
        console.log("replyChat", replyChat);
        if (replyChat) {
          this.bot.telegram
            .copyMessage(
              replyChat,
              body.message.chat.id,
              body.message.message_id
            )
            .catch((error) => {
              console.error("Telegraf error", error);
            });
        }
      }

      if (
        body.message &&
        body.message.text &&
        (body.message.text.toLowerCase() == "algolia" ||
          body.message.text.toLowerCase() == "list")
      ) {
        await algoliaWriteTokens();
        return;
      }

      if (
        body.message &&
        body.message.text &&
        body.message.text.toLowerCase() == "test"
      ) {
        await callLambda(
          "test",
          JSON.stringify({
            id: chatIdString,
            auth: CHATGPTPLUGINAUTH,
          })
        );
        return;
      }

      return;
    }
    console.log("Message:", body.message);
    const forwarded = await this.bot.telegram.forwardMessage(
      process.env.SUPPORT_CHAT!,
      chatId,
      body.message.message_id
    );
    //console.log("Forwarded", forwarded);
    this.bot.telegram
      .sendMessage(
        process.env.SUPPORT_CHAT!,
        body.message.from.id.toString() +
          " " +
          username +
          "\n" +
          (body.message.from.first_name
            ? body.message.from.first_name.toString() + " "
            : " ") +
          (body.message.from.last_name
            ? body.message.from.last_name.toString()
            : "") +
          "\nReply to this message",
        {
          reply_to_message_id: forwarded.message_id,
          disable_notification: true,
        }
      )
      .catch((error) => {
        console.error("Telegraf error", error);
      });

    let currState = await this.users.getItem(chatIdString);
    let currIndexAnswer = currState && currState.currentAnswer;
    if (!currIndexAnswer) currIndexAnswer = 0;
    let current_message_id = currState && currState.message_id;
    let parentMessage: string = "";
    if (currState && currState.message) parentMessage = currState.message;
    if (!current_message_id) current_message_id = "";
    console.log(
      "current_message_id",
      current_message_id,
      "new message id",
      body.message.message_id.toString()
    );
    if (current_message_id.toString() === body.message.message_id.toString()) {
      console.log("Already answered");
      return;
    }
    await initLanguages();
    let LANGUAGE: string = "en";
    if (body.message && body.message.from && body.message.from.language_code)
      LANGUAGE = body.message.from.language_code;
    else LANGUAGE = await this.users.getCurrentLanguage(chatIdString);
    const T = getT(LANGUAGE);
    const currQuestion: FormQuestion = formQuestions[currIndexAnswer];

    if (
      command == "new" ||
      command == '"new"' ||
      command == "\\new" ||
      command == "/new"
    ) {
      await this.users.resetAnswer(chatIdString);
      await this.message(T("createNFT"));
      return;
    }

    if (
      command == "voice" ||
      command == "voiceon" ||
      command == '"voiceon"' ||
      command == "\\voiceon" ||
      command == "/voiceon"
    ) {
      await setVoice(chatIdString, true);
      await this.history.add(T("voiceon"), false);
      await callLambda(
        "ask",
        JSON.stringify({
          id: chatIdString,
          message: "voice is on", //  "Iwanttosell": "I want to sell my Mina NFT"
          parentMessage: parentMessage,
          image: "",
          auth: CHATGPTPLUGINAUTH,
        })
      );
      //await this.message(T("voiceon"));
      return;
    }

    if (
      command == "voiceoff" ||
      command == '"voiceoff"' ||
      command == "\\voiceoff" ||
      command == "/voiceoff"
    ) {
      await setVoice(chatIdString, false);
      await this.history.add(T("voiceoff"), false);
      await callLambda(
        "ask",
        JSON.stringify({
          id: chatIdString,
          message: "voice is off", //  "Iwanttosell": "I want to sell my Mina NFT"
          parentMessage: parentMessage,
          image: "",
          auth: CHATGPTPLUGINAUTH,
        })
      );
      //await this.message(T("voiceoff"));
      return;
    }

    if (command == "sell" || command == "/sell") {
      console.log("Sell function calling");
      await callLambda(
        "ask",
        JSON.stringify({
          id: chatIdString,
          message: T("Iwanttosell"), //  "Iwanttosell": "I want to sell my Mina NFT"
          parentMessage: parentMessage,
          image: "",
          auth: CHATGPTPLUGINAUTH,
        })
      );
      return;
    }

    if (command == "buy" || command == "/buy") {
      await this.message(T("buyNFT"));

      await botCommandBuy(chatIdString, LANGUAGE);
      return;
    }

    if (
      command.substring(0, 9) == "archetype" ||
      command.substring(0, 10) == "/archetype"
    ) {
      await this.message(T("archetype"));

      await callLambda(
        "archetype",
        JSON.stringify({
          id: chatIdString,
          message: command.substring(0, 10),
          username: currState && currState.username ? currState.username : "",
          auth: CHATGPTPLUGINAUTH,
        })
      );
      return;
    }

    if (command == "list" || command == "/list") {
      await botCommandList(chatIdString, LANGUAGE);
      return;
    }

    if (command == "support" || body.message.text == "/support") {
      await supportTicket(chatIdString, LANGUAGE);
      return;
    }

    if (command == "auth" || body.message.text == "/auth") {
      await this.message(generateJWT(chatIdString), false);
      await this.message(T("authorizationCode"));
      return;
    }

    if (body.message.location) {
      await this.message(T(this.questions.typeError));
      return;
    }

    if (body.message.contact && currQuestion.type === "phone") {
      console.log("Contact", body.message.contact);
      if (body.message.contact.phone_number) {
        await this.users.updateAnswer(
          chatIdString,
          currIndexAnswer,
          body.message.contact.phone_number.toString()
        );
        currIndexAnswer++;
      }
      const optionsRemove = <ReplyKeyboardRemove>{
        remove_keyboard: true,
        selective: false,
      };
      await this.message(T(this.questions.questions[currIndexAnswer].text));
    }

    if (body.message.photo) {
      const photo = body.message.photo[body.message.photo.length - 1];
      const timeNow = Date.now();
      const filename = "image." + getFormattedDateTime(timeNow) + ".jpg";
      const file = await copyTelegramImageToS3(
        chatIdString,
        filename,
        photo.file_id,
        true
      );
      if (file === undefined) {
        console.error("Image is undefined");
        return;
      }
      const fileTable = new FilesTable(FILES_TABLE);
      await fileTable.create(file);
      if (currIndexAnswer == 1) {
        if (!(currState && currState.username)) {
          console.log("No username", currState);
          await this.message(T("chooseNFTname"));
          return;
        }
        console.log("Image  data:", body.message.caption, photo);
        try {
          /*
          const timeNow = Date.now();
          const filename = generateFilename(timeNow) + ".jpg";
          await copyTelegramImageToS3(
            chatIdString,
            filename,
            photo.file_id,
            false
          );
          */
          await startDeployment({
            id: chatIdString,
            language: LANGUAGE,
            timeNow,
            filename,
            username: currState.username,
            creator:
              currState.user && currState.user.username
                ? currState.user.username
                : "",
          } as BotMintData);
          this.users.updateAnswer(
            chatIdString,
            currIndexAnswer,
            "image uploaded"
          );
          await this.message(T(this.questions.finalWords));
          return;
        } catch (error) {
          console.error("Image catch", (<any>error).toString());
        }
      } else {
        try {
          await this.history.add(
            T("file.uploaded", { filedata: JSON.stringify(file) }),
            false
          );
          await this.message(T(this.questions.fileSuccess));
          await callLambda(
            "ask",
            JSON.stringify({
              id: chatIdString,
              message: "photo is uploaded", //  "Iwanttosell": "I want to sell my Mina NFT"
              parentMessage: parentMessage,
              image: "",
              auth: CHATGPTPLUGINAUTH,
            })
          );
          return;
        } catch (error) {
          console.error("Image catch", (<any>error).toString());
        }
      }
    }

    if (body.message.voice) {
      const voice = body.message.voice;
      console.log(
        "Voice  data:",
        voice.duration,
        voice.file_size,
        voice.mime_type
      );
      const voiceData = <VoiceData>{
        mime_type: voice.mime_type,
        file_id: voice.file_id,
        file_size: voice.file_size,
      };
      try {
        const voiceHandler = new VoiceHandler(voiceData);
        const voiceResult: string | undefined =
          await voiceHandler.copyVoiceToS3(chatIdString, parentMessage);
        if (voiceResult) {
          console.log("voiceResult", voiceResult);
          userInput = voiceResult;
        }
      } catch (error) {
        console.error("Voice catch", (<any>error).toString());
        return;
      }
    }

    if (body.message.audio) {
      const audio = body.message.audio;
      console.log(
        "Audio  data:",
        audio.file_name,
        audio.duration,
        audio.file_size,
        audio.mime_type
      );

      await callLambda(
        "audio",
        JSON.stringify({
          id: chatIdString,
          audio,
          auth: CHATGPTPLUGINAUTH,
        })
      );
      return;
    }

    if (body.message.document) {
      console.log("Document", body.message.document);
      const documentData = <DocumentData>body.message.document;
      const fileHandler = new FileHandler(chatIdString, documentData);
      const file = await fileHandler.copyFileToS3(chatIdString); //, this.parseObjectToHtml(item));
      if (file === undefined) {
        console.error("File is undefined");
        return;
      }
      const fileTable = new FilesTable(FILES_TABLE);
      await fileTable.create(file);
      await this.history.add(
        T("file.uploaded", { filedata: JSON.stringify(file) }),
        false
      );
      await this.message(T(this.questions.fileSuccess));
      await callLambda(
        "ask",
        JSON.stringify({
          id: chatIdString,
          message: "file is uploaded", //  "Iwanttosell": "I want to sell my Mina NFT"
          parentMessage: parentMessage,
          image: "",
          auth: CHATGPTPLUGINAUTH,
        })
      );
      return;

      /*
      if (this.validator.validateWrittenDocument(documentData)) {
        //await this.users.updateAnswer(chatIdString, currIndexAnswer, documentData.file_name);
        //const item = await this.users.getItem(chatIdString);
        const fileHandler = new FileHandler(chatIdString, documentData);
        const file = await fileHandler.copyFileToS3(chatIdString); //, this.parseObjectToHtml(item));
        await this.message(T(this.questions.fileSuccess));
        //currIndexAnswer++;
      } else {
        await this.message(T(this.questions.typeError));
      }
      */
    }

    if (
      currIndexAnswer >= formQuestions.length &&
      userInput &&
      userInput.substring(0, 6) !== "/start"
    ) {
      console.log("currIndexAnswer", currIndexAnswer);
      const askChatGPT = userInput;
      if (askChatGPT) {
        console.log("ChatGPT question:", askChatGPT);
        await callLambda(
          "ask",
          JSON.stringify({
            id: chatIdString,
            message: askChatGPT,
            image: "",
            username: currState && currState.username ? currState.username : "",
            auth: CHATGPTPLUGINAUTH,
          })
        );
      }
      return;
    }

    if (userInput) {
      if (userInput.substring(0, 6) === "/start" && currIndexAnswer === 0) {
        console.log(
          "New user",
          body.message.chat,
          body.message.from.language_code
        );
        const user: UserData = <UserData>{
          id: chatIdString,
          username,
          minanft: [],
          message_id: body.message.message_id.toString(),
          message: "",
          currentAnswer: 0,
          user: body.message.chat,
          language_code: body.message.from.language_code
            ? body.message.from.language_code
            : "en",
          chatGPTinit: false,
        };
        this.users.create(user);
        /*
    const options = <ReplyKeyboardMarkup>{keyboard: [[<KeyboardButton>{text: T(this.questions.phoneButton), request_contact: true}]], 
                                          resize_keyboard: true,
                                          one_time_keyboard: true};
                                          
        add it back if the phone number is needed for KYC								  
*/
        await this.message(
          `${T(this.questions.welcomeWords)}\n\n${T(currQuestion.text)}`
        );
        this.bot.telegram
          .sendMessage(
            process.env.SUPPORT_CHAT!,
            "New user:\n" +
              JSON.stringify(body.message.chat, null, "\n") +
              "language: " +
              body.message.from.language_code
              ? body.message.from.language_code
              : "en"
          )
          .catch((error) => {
            console.error("Telegraf error", error);
          });
      } else {
        if (userInput.substring(0, 6) === "/start" && userInput.length > 6) {
          console.log("Deep link ", userInput);
          if (userInput.substring(7) == "auth") {
            await this.message(generateJWT(chatIdString), false);
            await this.message(T("authorizationCode"));
          } else {
            await callLambda(
              "deployipfs",
              JSON.stringify({
                id: chatIdString,
                command: userInput.substring(7),
                creator: username ? username : "",
                language: LANGUAGE,
              })
            );
          }
          return;
        }
        if (
          userInput &&
          this.validator.validate(currQuestion.type, userInput)
        ) {
          if (currIndexAnswer == 0) {
            userInput =
              userInput[0] == "@"
                ? userInput.toLowerCase()
                : "@" + userInput.toLowerCase();

            const names = new Names(NAMES_TABLE);
            const name = await names.get(userInput);
            if (name) {
              console.log("Found the same name", name);
              await this.message(T("nameTaken"));
              return;
            }
            if (reservedNames.includes(userInput.toLowerCase().substr(1, 30))) {
              console.log("Name is reserved", name);
              await this.message(T("nameReserved"));
              return;
            }
          }
          this.users.updateAnswer(
            chatIdString,
            currIndexAnswer,
            currIndexAnswer == 0 ? userInput.toLowerCase() : userInput
          );
          currIndexAnswer++;
          if (currIndexAnswer < formQuestions.length)
            await this.message(
              T(this.questions.questions[currIndexAnswer].text)
            );
        } else {
          await this.message(
            `${
              currQuestion.error
                ? T(currQuestion.error)
                : T(this.questions.commonError)
            }`
          );
        }
      }

      if (currIndexAnswer === formQuestions.length) {
        if (!(currState && currState.username)) {
          console.error("No username", currState);
          return;
        }
        const askChatGPT = userInput;
        if (askChatGPT)
          await callLambda(
            "image",
            JSON.stringify({
              id: chatIdString,
              message: askChatGPT,
              username: currState.username,
              creator:
                currState.user && currState.user.username
                  ? currState.user.username
                  : "",
              image: "",
              auth: CHATGPTPLUGINAUTH,
            })
          );

        await this.message(T(this.questions.finalWords));
        await this.users.increaseCounter(chatIdString, ++currIndexAnswer);
      }
      return;
    }
  }
}
