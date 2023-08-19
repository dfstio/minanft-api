import { Telegraf, Context } from "telegraf";
import Questions from "./questions";
import DynamoDbConnector from "./connector/dynamoDbConnector";
import Names from "./connector/names";
import History from "./connector/history";
import {
    startDeployment,
    startDeploymentIpfs,
    generateFilename,
} from "./nft/nft";
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
//import ChatGPTMessage from "./chatgpt/chatgpt";
//import { context } from "./chatgpt/context";
//import { functions } from "./chatgpt/functions";
import { reservedNames } from "./nft/reservednames";
import { generateJWT } from "./api/jwt";
import { algoliaWriteTokens } from "./nft/algolia";
import {
    supportTicket,
    botCommandList,
    botCommandBuy,
    botCommandCallback,
} from "./payments/botcommands";

const CHATGPT_TOKEN = process.env.CHATGPT_TOKEN!;
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH!;
const NAMES_TABLE = process.env.NAMES_TABLE!;
const HISTORY_TABLE = process.env.HISTORY_TABLE!;
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
    id: string | undefined;
    supportId: string;
    history: History | undefined;
    //chat: ChatGPTMessage;
    dbConnector: DynamoDbConnector;
    validator: Validator;
    questions: Questions;

    constructor(
        token: string = process.env.BOT_TOKEN!,
        supportId: string = process.env.SUPPORT_CHAT!,
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
        this.bot.catch((err, ctx: any) => {
            console.error(`Telegraf error for ${ctx.updateType}`, err);
        });
        //this.chat = new ChatGPTMessage(CHATGPT_TOKEN, context, functions);
        this.questions = new Questions();
        this.dbConnector = new DynamoDbConnector(process.env.DYNAMODB_TABLE!);
        this.validator = new Validator();
        this.id = undefined;
    }

    public async activate(body: any) {
        return await this.bot.handleUpdate(body);
    }

    public async message(msg: string, logHistory = true): Promise<void> {
        if (this.id) {
            this.bot.telegram.sendMessage(this.id, msg).catch((error) => {
                console.error(`Telegraf error`, error);
            });
            if (this.history && logHistory) await this.history.add(msg);
        } else console.error("No id for message:", msg);

        if (logHistory) {
            const supportMsg: string = `Message for ${this.id}: ${msg}`;
            this.bot.telegram
                .sendMessage(this.supportId, supportMsg)
                .catch((error) => {
                    console.error(`Telegraf error`, error);
                });
            console.log(supportMsg);
        }
    }

    public async handleMessage(body: any): Promise<void> {
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

        const formQuestions = this.questions.questions;
        const chatId =
            body.message && body.message.chat && body.message.chat.id;

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
            await this.message("Thank you for payment");
            return;
        }

        if (chatId == process.env.SUPPORT_CHAT) {
            console.log("Support message", body);
            //TODO: If message === "approve" then call lambda to add verifier's signature to the smart contract
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
                            body.message.message_id,
                        )
                        .catch((error) => {
                            console.error(`Telegraf error`, error);
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
        if (
            current_message_id.toString() === body.message.message_id.toString()
        ) {
            console.log("Already answered");
            return;
        }
        let LANGUAGE = await this.dbConnector.getCurrentLanguage(chatIdString);
        if (LANGUAGE !== "en" && LANGUAGE !== "it") LANGUAGE = "en";
        const currQuestion: FormQuestion = formQuestions[currIndexAnswer];

        if (
            command == "new" ||
            command == `"new"` ||
            command == `\new` ||
            command == `/new`
        ) {
            await this.dbConnector.resetAnswer(chatIdString);
            await this.message(
                "Let's create another MINA NFT. Please choose your Mina NFT avatar name",
            );
            return;
        }

        if (command == "sell" || command == `/sell`) {
            console.log("Sell function calling");
            await callLambda(
                "ask",
                JSON.stringify({
                    id: chatIdString,
                    message: `I want to sell my Mina NFT`,
                    parentMessage: parentMessage,
                    image: "",
                    //function_call: "sell",
                    //role: "assistant",
                    auth: CHATGPTPLUGINAUTH,
                }),
            );
            return;
        }

        if (command == "buy" || command == `/buy`) {
            await this.message(
                "Let's buy an amazing MINA NFT. Look what NFTs are available for sale",
            );

            await botCommandBuy(chatIdString);
            return;
        }

        if (command == "list" || command == `/list`) {
            await botCommandList(chatIdString);
            return;
        }

        if (command == "support" || body.message.text == `/support`) {
            await supportTicket(chatIdString);
            return;
        }

        if (command == "auth" || body.message.text == `/auth`) {
            await this.message(generateJWT(chatIdString), false);
            await this.message(
                `This authorization code you can use in minanft.io or minanft nodejs library`,
            );
            return;
        }

        if (command == "secret" || command == `/secret`) {
            if (!(currState && currState.username)) {
                console.log("secret - No username", currState);
                await this.message("Please first create NFT");
                return;
            }

            const names = new Names(NAMES_TABLE);
            const name = await names.get(currState.username);
            if (name && name.deploy && name.deploy.secret)
                // we do not add to history
                this.bot.telegram
                    .sendMessage(chatIdString, name.deploy.secret)
                    .catch((error) => {
                        console.error(`Telegraf error`, error);
                    });
            else
                await this.message(
                    `Secret key for you Mina Avatar NFT @${currState.username} is not created yet`,
                );

            return;
        }

        if (body.message.location) {
            await this.message(this.questions.typeError[LANGUAGE]);
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
            await this.message(
                this.questions.questions[currIndexAnswer].text[LANGUAGE],
            );
        }

        if (body.message.photo) {
            if (!(currState && currState.username)) {
                console.log("No username", currState);
                await this.message("Please choose your Mina NFT avatar name");
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
                        currState.user && currState.user.username
                            ? currState.user.username
                            : "",
                    );
                    this.dbConnector.updateAnswer(
                        chatIdString,
                        currIndexAnswer,
                        "image uploaded",
                    );
                    await this.message(this.questions.finalWords[LANGUAGE]);
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
                    await voiceHandler.copyVoiceToS3(
                        chatIdString,
                        parentMessage,
                    );
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
        }

        if (body.message.document) {
            console.log("Document", body.message.document);
            const documentData = <DocumentData>body.message.document;
            if (this.validator.validateWrittenDocument(documentData)) {
                //await this.dbConnector.updateAnswer(chatIdString, currIndexAnswer, documentData.file_name);
                //const item = await this.dbConnector.getItem(chatIdString);
                const fileHandler = new FileHandler(documentData);
                await fileHandler.copyFileToS3(chatIdString); //, this.parseObjectToHtml(item));
                await this.message(this.questions.fileSuccess[LANGUAGE]);
                //currIndexAnswer++;
            } else {
                await this.message(this.questions.typeError[LANGUAGE]);
            }
        }

        if (
            currIndexAnswer >= formQuestions.length &&
            userInput &&
            userInput.substr(0, 6) !== "/start"
        ) {
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
                        username:
                            currState && currState.username
                                ? currState.username
                                : "",
                        auth: CHATGPTPLUGINAUTH,
                    }),
                );
            }
            return;
        }

        if (userInput) {
            if (userInput.substr(0, 6) === "/start" && currIndexAnswer === 0) {
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
                await this.message(
                    `${this.questions.welcomeWords[LANGUAGE]}\n\n${currQuestion.text[LANGUAGE]}`,
                );
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
                    userInput.substr(0, 6) === "/start" &&
                    userInput.length > 6
                ) {
                    console.log("Deep link ", userInput);
                    if (userInput.substring(7) == "auth") {
                        await this.message(generateJWT(chatIdString), false);
                        await this.message(
                            `This authorization code you can use in minanft.io or minanft nodejs library`,
                        );
                    } else {
                        await callLambda(
                            "deployipfs",
                            JSON.stringify({
                                id: chatIdString,
                                command: userInput.substring(7),
                                creator: username ? username : "",
                                auth: CHATGPTPLUGINAUTH,
                            }),
                        );

                        /*
                        await startDeploymentIpfs(
                            chatIdString,
                            userInput.substring(7),
                            username ? username : "",
                        );
                    */
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
                            await this.message(
                                `This name is already taken. Please choose another Mina NFT avatar name`,
                            );
                            return;
                        }
                        if (
                            reservedNames.includes(
                                userInput.toLowerCase().substr(1, 30),
                            )
                        ) {
                            console.log("Name is reserved", name);
                            await this.message(
                                `This name is reserved. Please choose another Mina NFT avatar name`,
                            );
                            return;
                        }
                    }
                    this.dbConnector.updateAnswer(
                        chatIdString,
                        currIndexAnswer,
                        currIndexAnswer == 0
                            ? userInput.toLowerCase()
                            : userInput,
                    );
                    currIndexAnswer++;
                    if (currIndexAnswer < formQuestions.length)
                        await this.message(
                            this.questions.questions[currIndexAnswer].text[
                                LANGUAGE
                            ],
                        );
                } else {
                    await this.message(
                        `${
                            currQuestion.error
                                ? currQuestion.error[LANGUAGE]
                                : this.questions.commonError[LANGUAGE]
                        }`,
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
                            parentMessage: parentMessage,
                            image: "",
                            auth: CHATGPTPLUGINAUTH,
                        }),
                    );

                await this.message(this.questions.finalWords[LANGUAGE]);
                await this.dbConnector.increaseCounter(
                    chatIdString,
                    ++currIndexAnswer,
                );
                await this.dbConnector.updateMessageId(
                    chatIdString,
                    body.message.message_id.toString(),
                );
            }
            return;
        }
    }
}
