"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = require("openai");
const users_1 = __importDefault(require("../table/users"));
const history_1 = __importDefault(require("../table/history"));
const functions_1 = require("./functions");
const archetypes_1 = require("./archetypes");
const HISTORY_TABLE = process.env.HISTORY_TABLE;
class ChatGPTMessage {
    constructor(token, language, context = "", functions = []) {
        const configuration = new openai_1.Configuration({
            apiKey: token,
        });
        this.api = new openai_1.OpenAIApi(configuration);
        this.context = context;
        this.functions = functions;
        this.language = language;
    }
    async message(params) {
        const { message, parentMessage, id, image, function_call, role, username } = params;
        const users = new users_1.default(process.env.DYNAMODB_TABLE);
        const history = new history_1.default(HISTORY_TABLE, id);
        const pMessage = parentMessage ? parentMessage : "";
        let isImage = false;
        let prompt = message;
        const errorMsg = "ChatGPT error. Please try again in few minutes";
        let answer = {
            image: "",
            answerType: "text",
            text: errorMsg,
        };
        if (image !== "")
            isImage = true;
        if (message.length > 6 && message.substr(0, 5).toLowerCase() === "image") {
            isImage = true;
            prompt = message.substr(6);
        }
        if (message.length > 9 &&
            message.substr(0, 8).toLowerCase() === "immagine") {
            isImage = true;
            prompt = message.substr(9);
        }
        if (isImage) {
            console.log("Image prompt:", prompt);
            let image_url = "";
            try {
                const defaultImageParams = {
                    n: 1,
                    prompt,
                };
                const inputParams = {
                    n: 1,
                    prompt,
                    user: id,
                };
                const response = await this.api.createImage({
                    ...defaultImageParams,
                    ...inputParams,
                });
                if (response &&
                    response.data &&
                    response.data.data &&
                    response.data.data[0].url)
                    image_url = response.data.data[0].url;
                await users.updateImageUsage(id);
                console.log("Image result", image_url, response.data);
            }
            catch (error) {
                console.error("createImage error");
                if (error &&
                    error.response &&
                    error.response.data &&
                    error.response.data.error &&
                    error.response.data.error.message) {
                    console.error(error.response.data.error);
                    answer.text =
                        errorMsg + " : " + error.response.data.error.message.toString();
                }
                return answer;
            }
            return {
                image: image_url,
                answerType: "image",
                text: prompt,
            };
        }
        const chatcontext = [
            {
                role: openai_1.ChatCompletionRequestMessageRoleEnum.Assistant,
                content: this.context,
            },
        ];
        const request = role == "assistant"
            ? [
                {
                    role: openai_1.ChatCompletionRequestMessageRoleEnum.Assistant,
                    content: message,
                },
            ]
            : [];
        try {
            const messages = await history.build(chatcontext, request);
            console.log("Request chatGptMessages", messages);
            const completion = await this.api.createChatCompletion({
                model: "gpt-4",
                messages,
                functions: this.functions,
                function_call: function_call ? { name: function_call } : undefined,
                user: id,
            });
            console.log("ChatGPT full log", completion.data);
            if (completion.data.usage)
                await users.updateUsage(id, completion.data.usage);
            const message = completion.data.choices[0].message;
            if (message) {
                console.log("ChatGPT", message);
                await history.addAnswer(completion.data.choices[0].message);
                if (message.function_call) {
                    await (0, functions_1.handleFunctionCall)(id, message.function_call, username, this.language);
                    answer.answerType = "function";
                    answer.text = "";
                }
                if (message.content)
                    answer.text = message.content;
            }
            return answer;
        }
        catch (error) {
            if (error.response.data.error.message) {
                console.error("ChatGPT error", error.response.data.error.message);
                answer.text =
                    answer.text + " : " + error.response.data.error.message.toString();
            }
            else
                console.error("ChatGPT error", error);
            return answer;
        }
    }
    async image(msg, parentMessage, id, username, isArchetype = false) {
        const users = new users_1.default(process.env.DYNAMODB_TABLE);
        const pMessage = parentMessage ? parentMessage : "";
        let isImage = false;
        const errorMsg = "ChatGPT error. Please try again in few minutes";
        let answer = {
            image: "",
            answerType: "text",
            text: errorMsg,
        };
        let prompt = msg.substr(0, 999);
        let fullPrompt = msg;
        const art = isArchetype ? archetypes_1.dalle : archetypes_1.archetypes;
        const chatGptMessages = pMessage == ""
            ? [
                {
                    role: openai_1.ChatCompletionRequestMessageRoleEnum.System,
                    content: isArchetype ? art : art + username,
                },
                {
                    role: openai_1.ChatCompletionRequestMessageRoleEnum.User,
                    content: msg,
                },
            ]
            : [
                {
                    role: openai_1.ChatCompletionRequestMessageRoleEnum.User,
                    content: pMessage,
                },
                {
                    role: openai_1.ChatCompletionRequestMessageRoleEnum.System,
                    content: isArchetype ? art : art + username,
                },
                {
                    role: openai_1.ChatCompletionRequestMessageRoleEnum.User,
                    content: msg,
                },
            ];
        try {
            const completion = await this.api.createChatCompletion({
                model: "gpt-4",
                messages: chatGptMessages,
                user: id,
            });
            console.log("ChatGPT", completion.data.choices[0].message?.content);
            if (completion.data.choices[0].message &&
                completion.data.choices[0].message.content &&
                completion.data.usage) {
                fullPrompt = completion.data.choices[0].message.content;
                prompt = completion.data.choices[0].message.content.substr(0, 999);
            }
            await users.updateUsage(id, completion.data.usage);
            if (isArchetype && fullPrompt.length > 999) {
                const completion = await this.api.createChatCompletion({
                    model: "gpt-4",
                    messages: [
                        {
                            role: openai_1.ChatCompletionRequestMessageRoleEnum.System,
                            content: "Maximum size of description should be strictly 1000 characters. Do not provide description with the size more than 1000 characters. Please shorten the user input so it would be not more than 1000 characters",
                        },
                        {
                            role: openai_1.ChatCompletionRequestMessageRoleEnum.User,
                            content: fullPrompt,
                        },
                    ],
                    user: id,
                });
                if (completion.data.choices[0].message &&
                    completion.data.choices[0].message.content &&
                    completion.data.usage) {
                    prompt = completion.data.choices[0].message.content.substr(0, 999);
                    await users.updateUsage(id, completion.data.usage);
                }
            }
        }
        catch (err) {
            console.error(err);
        }
        console.log("Image prompt:", prompt);
        console.log("Image full prompt:", fullPrompt);
        let image_url = "";
        try {
            const defaultImageParams = {
                n: 1,
                prompt,
            };
            const inputParams = {
                n: 1,
                prompt,
                user: id,
            };
            const response = await this.api.createImage({
                ...defaultImageParams,
                ...inputParams,
            });
            if (response &&
                response.data &&
                response.data.data &&
                response.data.data[0].url)
                image_url = response.data.data[0].url;
            await users.updateImageUsage(id);
            console.log("Image result", image_url, response.data);
        }
        catch (error) {
            console.error("createImage error");
            if (error &&
                error.response &&
                error.response.data &&
                error.response.data.error &&
                error.response.data.error.message) {
                console.error(error.response.data.error);
                answer.text =
                    errorMsg + " : " + error.response.data.error.message.toString();
            }
            return answer;
        }
        return {
            image: image_url,
            answerType: "image",
            text: isArchetype ? archetypes_1.midjourney + fullPrompt : prompt,
        };
    }
}
exports.default = ChatGPTMessage;
//# sourceMappingURL=chatgpt.js.map