"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const questions_1 = __importDefault(require("./questions"));
const lang_1 = require("./lang/lang");
const users_1 = __importDefault(require("./table/users"));
const names_1 = __importDefault(require("./table/names"));
const history_1 = __importDefault(require("./table/history"));
const nft_1 = require("./nft/nft");
const fileHandler_1 = __importDefault(require("./fileHandler"));
const imageHandler_1 = require("./imageHandler");
const voiceHandler_1 = __importDefault(require("./voiceHandler"));
const validator_1 = __importDefault(require("./validator"));
const lambda_1 = __importDefault(require("./lambda/lambda"));
const reservednames_1 = require("./nft/reservednames");
const jwt_1 = require("./api/jwt");
const algolia_1 = require("./nft/algolia");
const botcommands_1 = require("./payments/botcommands");
const CHATGPTPLUGINAUTH = process.env.CHATGPTPLUGINAUTH;
const NAMES_TABLE = process.env.NAMES_TABLE;
const HISTORY_TABLE = process.env.HISTORY_TABLE;
const LANG = process.env.LANG ? process.env.LANG : "en";
console.log("Language", LANG);
class BotLogic {
    constructor(token = process.env.BOT_TOKEN, supportId = process.env.SUPPORT_CHAT) {
        this.bot = new telegraf_1.Telegraf(token);
        this.supportId = supportId;
        this.bot.on("callback_query", async (ctx) => {
            await (0, botcommands_1.botCommandCallback)(ctx);
        });
        this.bot.hears("name", async (ctx) => {
            return await ctx.reply("MinaNFT");
        });
        this.bot.hears("link", async (ctx) => {
            return await ctx.reply("https://minanft.io");
        });
        this.bot.hears("Name", (ctx) => ctx.reply("MinaNFT"));
        this.bot.hears("Link", (ctx) => ctx.reply("https://minanft.io"));
        this.bot.on("message", async (ctx) => {
            return await this.handleMessage(ctx);
        });
        this.bot.catch((err, ctx) => {
            console.error(`Telegraf error for ${ctx.updateType}`, err);
        });
        this.questions = new questions_1.default();
        this.users = new users_1.default(process.env.DYNAMODB_TABLE);
        this.validator = new validator_1.default();
        this.id = undefined;
    }
    async activate(body) {
        return await this.bot.handleUpdate(body);
    }
    async message(msg, logHistory = true) {
        if (this.id) {
            this.bot.telegram.sendMessage(this.id, msg).catch((error) => {
                console.error("Telegraf error", error);
            });
            if (this.history != null && logHistory)
                await this.history.add(msg);
        }
        else
            console.error("No id for message:", msg);
        if (logHistory) {
            const supportMsg = `Message for ${this.id}: ${msg}`;
            this.bot.telegram
                .sendMessage(this.supportId, supportMsg)
                .catch((error) => {
                console.error("Telegraf error", error);
            });
            console.log(supportMsg);
        }
    }
    async handleMessage(body) {
        if (body.pre_checkout_query) {
            console.log("pre_checkout_query", body.pre_checkout_query.id);
            this.bot.telegram
                .answerPreCheckoutQuery(body.pre_checkout_query.id, true, "Please try again to pay")
                .catch((error) => {
                console.error("Telegraf error", error);
            });
            return;
        }
        const formQuestions = this.questions.questions;
        const chatId = body.message && body.message.chat && body.message.chat.id;
        let username = body.message && body.message.from && body.message.from.username;
        let userInput = body.message && body.message.text;
        const command = userInput ? userInput.toLowerCase() : "";
        if (!username)
            username = "";
        if (!chatId) {
            console.log("No message", body);
            return;
        }
        const chatIdString = chatId.toString();
        this.id = chatIdString;
        this.history = new history_1.default(HISTORY_TABLE, chatIdString);
        if (userInput)
            await this.history.add(userInput, true);
        if (body.message && body.message.successful_payment) {
            console.log("successful_payment");
            await this.message("Thank you for payment");
            return;
        }
        if (chatId == process.env.SUPPORT_CHAT) {
            console.log("Support message", body);
            if (body.message && body.message.reply_to_message) {
                const reply = body.message.reply_to_message;
                console.log("Support reply", reply);
                const replyChat = parseInt(reply.text.split("\n")[0]);
                console.log("replyChat", replyChat);
                if (replyChat) {
                    this.bot.telegram
                        .copyMessage(replyChat, body.message.chat.id, body.message.message_id)
                        .catch((error) => {
                        console.error("Telegraf error", error);
                    });
                }
            }
            if (body.message &&
                body.message.text &&
                (body.message.text.toLowerCase() == "algolia" ||
                    body.message.text.toLowerCase() == "list")) {
                await (0, algolia_1.algoliaWriteTokens)();
                return;
            }
            return;
        }
        console.log("Message:", body.message);
        const forwarded = await this.bot.telegram.forwardMessage(process.env.SUPPORT_CHAT, chatId, body.message.message_id);
        this.bot.telegram
            .sendMessage(process.env.SUPPORT_CHAT, body.message.from.id.toString() +
            " " +
            username +
            "\n" +
            (body.message.from.first_name
                ? body.message.from.first_name.toString() + " "
                : " ") +
            (body.message.from.last_name
                ? body.message.from.last_name.toString()
                : "") +
            "\nReply to this message", {
            reply_to_message_id: forwarded.message_id,
            disable_notification: true,
        })
            .catch((error) => {
            console.error("Telegraf error", error);
        });
        let currState = await this.users.getItem(chatIdString);
        let currIndexAnswer = currState && currState.currentAnswer;
        if (!currIndexAnswer)
            currIndexAnswer = 0;
        let current_message_id = currState && currState.message_id;
        let parentMessage = "";
        if (currState && currState.message)
            parentMessage = currState.message;
        if (!current_message_id)
            current_message_id = "";
        console.log("current_message_id", current_message_id, "new message id", body.message.message_id.toString());
        if (current_message_id.toString() === body.message.message_id.toString()) {
            console.log("Already answered");
            return;
        }
        await (0, lang_1.initLanguages)();
        let LANGUAGE = "en";
        if (body.message && body.message.from && body.message.from.language_code)
            LANGUAGE = body.message.from.language_code;
        else
            LANGUAGE = await this.users.getCurrentLanguage(chatIdString);
        const T = (0, lang_1.getT)(LANGUAGE);
        const currQuestion = formQuestions[currIndexAnswer];
        if (command == "new" ||
            command == '"new"' ||
            command == "\new" ||
            command == "/new") {
            await this.users.resetAnswer(chatIdString);
            await this.message(T("createNFT"));
            return;
        }
        if (command == "sell" || command == "/sell") {
            console.log("Sell function calling");
            await (0, lambda_1.default)("ask", JSON.stringify({
                id: chatIdString,
                message: T("Iwanttosell"),
                parentMessage: parentMessage,
                image: "",
                auth: CHATGPTPLUGINAUTH,
            }));
            return;
        }
        if (command == "buy" || command == "/buy") {
            await this.message(T("buyNFT"));
            await (0, botcommands_1.botCommandBuy)(chatIdString, LANGUAGE);
            return;
        }
        if (command.substring(0, 9) == "archetype" ||
            command.substring(0, 10) == "/archetype") {
            await this.message(T("archetype"));
            await (0, lambda_1.default)("archetype", JSON.stringify({
                id: chatIdString,
                message: command.substring(0, 10),
                username: (currState && currState.username) ? currState.username : '',
                auth: CHATGPTPLUGINAUTH,
            }));
            return;
        }
        if (command == "list" || command == "/list") {
            await (0, botcommands_1.botCommandList)(chatIdString, LANGUAGE);
            return;
        }
        if (command == "support" || body.message.text == "/support") {
            await (0, botcommands_1.supportTicket)(chatIdString, LANGUAGE);
            return;
        }
        if (command == "auth" || body.message.text == "/auth") {
            await this.message((0, jwt_1.generateJWT)(chatIdString), false);
            await this.message(T("authorizationCode"));
            return;
        }
        if (command == "secret" || command == "/secret") {
            if (!(currState && currState.username)) {
                console.log("secret - No username", currState);
                await this.message(T("NFTfirst"));
                return;
            }
            const names = new names_1.default(NAMES_TABLE);
            const name = await names.get(currState.username);
            if (name && name.deploy && name.deploy.secret)
                this.bot.telegram
                    .sendMessage(chatIdString, name.deploy.secret)
                    .catch((error) => {
                    console.error("Telegraf error", error);
                });
            else
                await this.message(T("Secretkeynotcreated", { username: currState.username }));
            return;
        }
        if (body.message.location) {
            await this.message(T(this.questions.typeError));
            return;
        }
        if (body.message.contact && currQuestion.type === "phone") {
            console.log("Contact", body.message.contact);
            if (body.message.contact.phone_number) {
                await this.users.updateAnswer(chatIdString, currIndexAnswer, body.message.contact.phone_number.toString());
                currIndexAnswer++;
            }
            const optionsRemove = {
                remove_keyboard: true,
                selective: false,
            };
            await this.message(T(this.questions.questions[currIndexAnswer].text));
        }
        if (body.message.photo) {
            if (!(currState && currState.username)) {
                console.log("No username", currState);
                await this.message(T("chooseNFTname"));
                return;
            }
            if (currIndexAnswer == 1) {
                const photo = body.message.photo[body.message.photo.length - 1];
                console.log("Image  data:", body.message.caption, photo);
                try {
                    const timeNow = Date.now();
                    const filename = (0, nft_1.generateFilename)(timeNow) + ".jpg";
                    await (0, imageHandler_1.copyTelegramImageToS3)(filename, photo.file_id);
                    await (0, nft_1.startDeployment)(chatIdString, LANGUAGE, timeNow, filename, currState.username, currState.user && currState.user.username
                        ? currState.user.username
                        : "");
                    this.users.updateAnswer(chatIdString, currIndexAnswer, "image uploaded");
                    await this.message(T(this.questions.finalWords));
                }
                catch (error) {
                    console.error("Image catch", error.toString());
                }
            }
        }
        if (body.message.voice) {
            const voice = body.message.voice;
            console.log("Voice  data:", voice.duration, voice.file_size, voice.mime_type);
            const voiceData = {
                mime_type: voice.mime_type,
                file_id: voice.file_id,
                file_size: voice.file_size,
            };
            try {
                const voiceHandler = new voiceHandler_1.default(voiceData);
                const voiceResult = await voiceHandler.copyVoiceToS3(chatIdString, parentMessage);
                if (voiceResult) {
                    console.log("voiceResult", voiceResult);
                    userInput = voiceResult;
                }
            }
            catch (error) {
                console.error("Voice catch", error.toString());
                return;
            }
        }
        if (body.message.audio) {
            const audio = body.message.audio;
            console.log("Audio  data:", audio.file_name, audio.duration, audio.file_size, audio.mime_type);
            await (0, lambda_1.default)("audio", JSON.stringify({
                id: chatIdString,
                audio,
                auth: CHATGPTPLUGINAUTH,
            }));
            return;
        }
        if (body.message.document) {
            console.log("Document", body.message.document);
            const documentData = body.message.document;
            if (this.validator.validateWrittenDocument(documentData)) {
                const fileHandler = new fileHandler_1.default(documentData);
                await fileHandler.copyFileToS3(chatIdString);
                await this.message(T(this.questions.fileSuccess));
            }
            else {
                await this.message(T(this.questions.typeError));
            }
        }
        if (currIndexAnswer >= formQuestions.length &&
            userInput &&
            userInput.substr(0, 6) !== "/start") {
            console.log("currIndexAnswer", currIndexAnswer);
            const askChatGPT = userInput;
            if (askChatGPT) {
                console.log("ChatGPT question:", askChatGPT);
                await (0, lambda_1.default)("ask", JSON.stringify({
                    id: chatIdString,
                    message: askChatGPT,
                    image: "",
                    username: currState && currState.username ? currState.username : "",
                    auth: CHATGPTPLUGINAUTH,
                }));
            }
            return;
        }
        if (userInput) {
            if (userInput.substr(0, 6) === "/start" && currIndexAnswer === 0) {
                console.log("New user", body.message.chat, body.message.from.language_code);
                const user = {
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
                    chatGPTinit: false
                };
                this.users.create(user);
                await this.message(`${T(this.questions.welcomeWords)}\n\n${T(currQuestion.text)}`);
                this.bot.telegram
                    .sendMessage(process.env.SUPPORT_CHAT, "New user:\n" +
                    JSON.stringify(body.message.chat, null, "\n") +
                    "language: " +
                    body.message.from.language_code
                    ? body.message.from.language_code
                    : "en")
                    .catch((error) => {
                    console.error("Telegraf error", error);
                });
            }
            else {
                if (userInput.substr(0, 6) === "/start" && userInput.length > 6) {
                    console.log("Deep link ", userInput);
                    if (userInput.substring(7) == "auth") {
                        await this.message((0, jwt_1.generateJWT)(chatIdString), false);
                        await this.message(T("authorizationCode"));
                    }
                    else {
                        await (0, lambda_1.default)("deployipfs", JSON.stringify({
                            id: chatIdString,
                            command: userInput.substring(7),
                            creator: username ? username : "",
                            language: LANGUAGE,
                        }));
                    }
                    return;
                }
                if (userInput &&
                    this.validator.validate(currQuestion.type, userInput)) {
                    if (currIndexAnswer == 0) {
                        userInput =
                            userInput[0] == "@"
                                ? userInput.toLowerCase()
                                : "@" + userInput.toLowerCase();
                        const names = new names_1.default(NAMES_TABLE);
                        const name = await names.get(userInput);
                        if (name) {
                            console.log("Found the same name", name);
                            await this.message(T("nameTaken"));
                            return;
                        }
                        if (reservednames_1.reservedNames.includes(userInput.toLowerCase().substr(1, 30))) {
                            console.log("Name is reserved", name);
                            await this.message(T("nameReserved"));
                            return;
                        }
                    }
                    this.users.updateAnswer(chatIdString, currIndexAnswer, currIndexAnswer == 0 ? userInput.toLowerCase() : userInput);
                    currIndexAnswer++;
                    if (currIndexAnswer < formQuestions.length)
                        await this.message(T(this.questions.questions[currIndexAnswer].text));
                }
                else {
                    await this.message(`${currQuestion.error
                        ? T(currQuestion.error)
                        : T(this.questions.commonError)}`);
                }
            }
            if (currIndexAnswer === formQuestions.length) {
                if (!(currState && currState.username)) {
                    console.error("No username", currState);
                    return;
                }
                const askChatGPT = userInput;
                if (askChatGPT)
                    await (0, lambda_1.default)("image", JSON.stringify({
                        id: chatIdString,
                        message: askChatGPT,
                        username: currState.username,
                        creator: currState.user && currState.user.username
                            ? currState.user.username
                            : "",
                        image: "",
                        auth: CHATGPTPLUGINAUTH,
                    }));
                await this.message(T(this.questions.finalWords));
                await this.users.increaseCounter(chatIdString, ++currIndexAnswer);
            }
            return;
        }
    }
}
exports.default = BotLogic;
//# sourceMappingURL=botLogic.js.map