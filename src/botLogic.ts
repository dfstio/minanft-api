import { Telegraf, Context } from "telegraf";
import Questions from "./questions";
import DynamoDbConnector from "./connector/dynamoDbConnector";
import Names from "./connector/names";
import { startDeployment, generateFilename } from "./nft/nft";
import DocumentData from "./model/documentData";
import AccountData from "./model/accountData";
import FileHandler from "./fileHandler";
import ImageData from "./model/imageData";
import VoiceData from "./model/voiceData";
import { copyTelegramImageToS3 } from "./imageHandler";
import VoiceHandler from "./voiceHandler";
import AudioHandler from "./audioHandler";
import Validator from "./validator";
import FormQuestion from "./model/formQuestion";
import FormAnswer from "./model/formAnswer";
import callLambda from "./mina/lambda";
import AWS from "aws-sdk";
import nodemailer from "nodemailer";
import ChatGPTMessage from "./chatgpt/chatgpt";
import { context } from "./chatgpt/context";
import { reservedNames } from "./nft/reservednames";
import { supportTicket } from "./payments/botcommands";

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;
const NAMES_TABLE = process.env.NAMES_TABLE!;
const LANG = process.env.LANG ? process.env.LANG : "en";
console.log("Language", LANG);

interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
}

interface ReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

export default class BotLogic {
  bot: Telegraf<Context>;
  chat: ChatGPTMessage;
  dbConnector: DynamoDbConnector;
  validator: Validator;
  questions: Questions;

  constructor() {
    this.bot = new Telegraf(process.env.BOT_TOKEN!);
    this.chat = new ChatGPTMessage(CHATGPT_TOKEN, context);
    this.questions = new Questions();
    this.dbConnector = new DynamoDbConnector(process.env.DYNAMODB_TABLE!);
    this.validator = new Validator();
  }

  public async activate(body: any): Promise<void> {
    this.bot.catch((err, ctx) => {
      console.error(`Telegraf error for ${ctx.updateType}`, err);
    });

    if (body.pre_checkout_query) {
      console.log("pre_checkout_query", body.pre_checkout_query.id);
      this.bot.telegram
        .answerPreCheckoutQuery(
          body.pre_checkout_query.id,
          true,
          "Please try again to pay",
        )
        .catch((error) => {
          console.error(`Telegraf error`, error);
        });
      return;
    }

    if (body.message && body.message.successful_payment) {
      console.log("successful_payment");
      if (body.message.chat && body.message.chat.id)
        this.bot.telegram
          .sendMessage(body.message.chat.id, "Thank you for payment")
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
      return;
    }

    const formQuestions = this.questions.questions;
    const chatId = body.message && body.message.chat && body.message.chat.id;
    let username =
      body.message && body.message.from && body.message.from.username;
    let userInput = body.message && body.message.text;
    if (!username) username = "";
    if (!chatId) {
      console.log("No message", body);
      return;
    }
    if (chatId == process.env.SUPPORT_CHAT) {
      console.log("Support message", body);
      //TODO: If message === "approve" then call lambda to add verifier's signature to the smart contract
      if (body.message.reply_to_message) {
        const reply = body.message.reply_to_message;
        console.log("Support reply", reply);
        const replyChat = parseInt(reply.text.split("\n")[0]);
        console.log("replyChat", replyChat);
        if (replyChat) {
          this.bot.telegram
            .copyMessage(
              replyChat,
              body.message.chat.id,
              body.message.message_id,
            )
            .catch((error) => {
              console.error(`Telegraf error`, error);
            });
        }
      }
      return;
    }
    console.log("Message:", body.message);
    const forwarded = await this.bot.telegram.forwardMessage(
      process.env.SUPPORT_CHAT!,
      chatId,
      body.message.message_id,
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
        },
      )
      .catch((error) => {
        console.error(`Telegraf error`, error);
      });

    const chatIdString = chatId.toString();
    let currState = await this.dbConnector.getCurrentState(chatIdString);
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
      body.message.message_id.toString(),
    );
    if (current_message_id.toString() === body.message.message_id.toString()) {
      console.log("Already answered");
      return;
    }
    let LANGUAGE = await this.dbConnector.getCurrentLanguage(chatIdString);
    if (LANGUAGE !== "en" && LANGUAGE !== "it") LANGUAGE = "en";
    const currQuestion: FormQuestion = formQuestions[currIndexAnswer];

    if (
      body.message.text &&
      (body.message.text == "new" ||
        body.message.text == `"new"` ||
        body.message.text == `\new` ||
        body.message.text == `/new`)
    ) {
      await this.dbConnector.resetAnswer(chatIdString);
      this.bot.telegram
        .sendMessage(
          chatId,
          "Let's create another MINA NFT. Please choose your Mina NFT avatar name",
        )
        .catch((error) => {
          console.error(`Telegraf error`, error);
        });
      return;
    }

    if (
      body.message.text &&
      (body.message.text == "sell" || body.message.text == `/sell`)
    ) {
      this.bot.telegram
        .sendMessage(
          chatId,
          "Let's sell your MINA NFT. Will implement selling functionality soon",
        )
        .catch((error) => {
          console.error(`Telegraf error`, error);
        });
      return;
    }

    if (
      body.message.text &&
      (body.message.text == "buy" || body.message.text == `/buy`)
    ) {
      this.bot.telegram
        .sendMessage(
          chatId,
          "Let's buy amazing MINA NFT. Will implement this functionality soon",
        )
        .catch((error) => {
          console.error(`Telegraf error`, error);
        });
      return;
    }

    if (
      body.message.text &&
      (body.message.text == "list" || body.message.text == `/list`)
    ) {
      this.bot.telegram
        .sendMessage(
          chatId,
          "Let's list amazing MINA NFTs. Will implement this functionality soon",
        )
        .catch((error) => {
          console.error(`Telegraf error`, error);
        });
      return;
    }

    if (
      body.message.text &&
      (body.message.text == "support" || body.message.text == `/support`)
    ) {
      await supportTicket();
      return;
    }


    if (
      body.message.text &&
      (body.message.text == "secret" || body.message.text == `/secret`)
    ) {
      if (!(currState && currState.username)) {
        console.log("secret - No username", currState);
        this.bot.telegram
          .sendMessage(chatId, "Please first create NFT")
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
        return;
      }

      const names = new Names(NAMES_TABLE);
      const name = await names.get(currState.username);
      if (name && name.deploy && name.deploy.secret)
        this.bot.telegram
          .sendMessage(
            chatId,
            `Secret key for you Mina Avatar NFT @${currState.username} is ${name.deploy.secret}`,
          )
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
      else
        this.bot.telegram
          .sendMessage(
            chatId,
            `Secret key for you Mina Avatar NFT @${currState.username} is not created yet`,
          )
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });

      return;
    }

    if (body.message.location) {
      this.bot.telegram
        .sendMessage(chatId, this.questions.typeError[LANGUAGE])
        .catch((error) => {
          console.error(`Telegraf error`, error);
        });
      return;
    }

    if (body.message.contact && currQuestion.type === "phone") {
      console.log("Contact", body.message.contact);
      if (body.message.contact.phone_number) {
        await this.dbConnector.updateAnswer(
          chatIdString,
          currIndexAnswer,
          body.message.contact.phone_number.toString(),
        );
        currIndexAnswer++;
      }
      const optionsRemove = <ReplyKeyboardRemove>{
        remove_keyboard: true,
        selective: false,
      };
      this.bot.telegram
        .sendMessage(
          chatId,
          this.questions.questions[currIndexAnswer].text[LANGUAGE],
          { reply_markup: optionsRemove },
        )
        .catch((error) => {
          console.error(`Telegraf error`, error);
        });
    }

    if (body.message.photo) {
      if (!(currState && currState.username)) {
        console.log("No username", currState);
        this.bot.telegram
          .sendMessage(chatId, "Please choose your Mina NFT avatar name")
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
        return;
      }
      if (currIndexAnswer == 1) {
        const photo = body.message.photo[body.message.photo.length - 1];
        console.log("Image  data:", body.message.caption, photo);
        try {
          const timeNow = Date.now();
          const filename = generateFilename(timeNow) + ".jpg";
          await copyTelegramImageToS3(filename, photo.file_id);
          await startDeployment(
            chatIdString,
            timeNow,
            filename,
            currState.username,
          );
          this.dbConnector.updateAnswer(
            chatIdString,
            currIndexAnswer,
            "image uploaded",
          );
          this.bot.telegram.sendMessage(
            chatId,
            this.questions.finalWords[LANGUAGE],
          );
          /*
        this.bot.telegram
          .sendMessage(chatIdString, this.questions.imageSuccess[LANGUAGE])
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
*/
        } catch (error) {
          console.error("Image catch", (<any>error).toString());
        }
      }
    }

    if (body.message.voice) {
      await this.dbConnector.updateMessageId(
        chatIdString,
        body.message.message_id.toString(),
      );
      const voice = body.message.voice;
      console.log(
        "Voice  data:",
        voice.duration,
        voice.file_size,
        voice.mime_type,
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
      await this.dbConnector.updateMessageId(
        chatIdString,
        body.message.message_id.toString(),
      );
      const audio = body.message.audio;
      console.log(
        "Audio  data:",
        audio.file_name,
        audio.duration,
        audio.file_size,
        audio.mime_type,
      );

      await callLambda(
        "audio",
        JSON.stringify({
          id: chatIdString,
          audio,
          auth: CHATGPTPLUGINAUTH,
        }),
      );
      return;
      /*
      try {
      const audioData = <VoiceData>{
        mime_type: audio.mime_type,
        file_id: audio.file_id,
        file_size: audio.file_size,
      };
        const audioHandler = new AudioHandler(audioData);
        await audioHandler.copyAudioToS3(chatIdString, audio.file_name);
        
        this.bot.telegram
          .sendMessage(chatIdString, this.questions.voiceSuccess[LANGUAGE])
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
		
        return;
      } catch (error) {
        console.error("Audio catch", (<any>error).toString());
        return;
      }
    */
    }

    if (body.message.document) {
      console.log("Document", body.message.document);
      const documentData = <DocumentData>body.message.document;
      if (this.validator.validateWrittenDocument(documentData)) {
        //await this.dbConnector.updateAnswer(chatIdString, currIndexAnswer, documentData.file_name);
        //const item = await this.dbConnector.getItem(chatIdString);
        const fileHandler = new FileHandler(documentData);
        await fileHandler.copyFileToS3(chatIdString); //, this.parseObjectToHtml(item));
        this.bot.telegram
          .sendMessage(chatIdString, this.questions.fileSuccess[LANGUAGE])
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
        //currIndexAnswer++;
      } else {
        this.bot.telegram
          .sendMessage(chatIdString, this.questions.typeError[LANGUAGE])
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
      }
    }

    if (currIndexAnswer >= formQuestions.length) {
      console.log("currIndexAnswer", currIndexAnswer);
      const askChatGPT = userInput;
      if (askChatGPT) {
        await this.dbConnector.updateMessageId(
          chatIdString,
          body.message.message_id.toString(),
          askChatGPT,
        );
        console.log("ChatGPT question:", askChatGPT);
        await callLambda(
          "ask",
          JSON.stringify({
            id: chatIdString,
            message: askChatGPT,
            parentMessage: parentMessage,
            image: "",
            auth: CHATGPTPLUGINAUTH,
          }),
        );
      }
      return;
    }

    if (userInput) {
      if (userInput === "/start" && currIndexAnswer === 0) {
        console.log(
          "New user",
          body.message.chat,
          body.message.from.language_code,
        );
        this.dbConnector.createForm(
          chatIdString,
          username,
          body.message.message_id.toString(),
          body.message.chat,
          body.message.from.language_code
            ? body.message.from.language_code
            : "en",
        );
        /*
      	const options = <ReplyKeyboardMarkup>{keyboard: [[<KeyboardButton>{text: this.questions.phoneButton[LANGUAGE], request_contact: true}]], 
      										  resize_keyboard: true,
      										  one_time_keyboard: true};
      										  
      		add it back if the phone number is needed for KYC								  
        */
        this.bot.telegram
          .sendMessage(
            chatId,
            `${this.questions.welcomeWords[LANGUAGE]}\n\n${currQuestion.text[LANGUAGE]}`,
            /*,{ reply_markup: options } */
          )
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
        this.bot.telegram
          .sendMessage(
            process.env.SUPPORT_CHAT!,
            "New user:\n" +
              JSON.stringify(body.message.chat, null, "\n") +
              "language: " +
              body.message.from.language_code
              ? body.message.from.language_code
              : "en",
          )
          .catch((error) => {
            console.error(`Telegraf error`, error);
          });
      } else {
        if (
          userInput &&
          this.validator.validate(currQuestion.type, userInput)
        ) {
          if (currIndexAnswer == 0) {
            const names = new Names(NAMES_TABLE);
            const name = await names.get(userInput.toLowerCase());
            if (name) {
              console.log("Found the same name", name);
              this.bot.telegram
                .sendMessage(
                  chatId,
                  `This name is already taken. Please choose another Mina NFT avatar name`,
                )
                .catch((error) => {
                  console.error(`Telegraf error`, error);
                });
              return;
            }
            if (reservedNames.includes(userInput.toLowerCase())) {
              console.log("Name is reserved", name);
              this.bot.telegram
                .sendMessage(
                  chatId,
                  `This name is reserved. Please choose another Mina NFT avatar name`,
                )
                .catch((error) => {
                  console.error(`Telegraf error`, error);
                });
              return;
            }
          }
          this.dbConnector.updateAnswer(
            chatIdString,
            currIndexAnswer,
            currIndexAnswer == 0 ? userInput.toLowerCase() : userInput,
          );
          currIndexAnswer++;
          if (currIndexAnswer < formQuestions.length)
            this.bot.telegram.sendMessage(
              chatId,
              this.questions.questions[currIndexAnswer].text[LANGUAGE],
            );
        } else {
          this.bot.telegram
            .sendMessage(
              chatId,
              `${
                currQuestion.error
                  ? currQuestion.error[LANGUAGE]
                  : this.questions.commonError[LANGUAGE]
              }`,
            )
            .catch((error) => {
              console.error(`Telegraf error`, error);
            });
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
              parentMessage: parentMessage,
              image: "",
              auth: CHATGPTPLUGINAUTH,
            }),
          );

        this.bot.telegram.sendMessage(
          chatId,
          this.questions.finalWords[LANGUAGE],
        );
        await this.dbConnector.increaseCounter(chatIdString, ++currIndexAnswer);
        await this.dbConnector.updateMessageId(
          chatIdString,
          body.message.message_id.toString(),
        );
        //const item = await this.dbConnector.getItem(chatIdString);
        /*
        const htmlText = this.parseObjectToHtml(item);
        if (htmlText) {
          this.mailSender(process.env.TO!, process.env.FROM!, htmlText);
        }
        */
      }
      return;
    }
  }
}
