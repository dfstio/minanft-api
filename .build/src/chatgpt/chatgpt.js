"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
const users_1 = __importDefault(require("../table/users"));
const history_1 = __importDefault(require("../table/history"));
const functions_1 = require("./functions");
const archetypes_1 = require("./archetypes");
const HISTORY_TABLE = process.env.HISTORY_TABLE;
class ChatGPTMessage {
    constructor(token, language, context = '', functions = []) {
        this.api = new openai_1.default({ apiKey: token });
        this.context = context;
        this.functions = functions;
        this.language = language;
    }
    async message(params) {
        const { message, id, image, username } = params;
        const users = new users_1.default(process.env.DYNAMODB_TABLE);
        const history = new history_1.default(HISTORY_TABLE, id);
        let isImage = false;
        let prompt = message;
        const errorMsg = 'ChatGPT error. Please try again in few minutes';
        let answer = {
            image: '',
            answerType: 'text',
            text: errorMsg,
        };
        if (image !== '')
            isImage = true;
        if (message.length > 6 && message.substr(0, 5).toLowerCase() === 'image') {
            isImage = true;
            prompt = message.substr(6);
        }
        if (message.length > 9 &&
            message.substr(0, 8).toLowerCase() === 'immagine') {
            isImage = true;
            prompt = message.substr(9);
        }
        if (isImage) {
            console.log('Image prompt:', prompt);
            let imageUrl = '';
            try {
                const imageParams = {
                    n: 1,
                    prompt,
                    user: id
                };
                const image = await this.api.images.generate(imageParams);
                if (image?.data[0]?.url !== undefined)
                    imageUrl = image.data[0].url;
                await users.updateImageUsage(id);
                console.log('Image result', imageUrl, image.data);
            }
            catch (error) {
                console.error('createImage error');
                if (error?.response?.data?.error?.message !== undefined) {
                    console.error(error.response.data.error);
                    answer.text =
                        errorMsg + ' : ' + error.response.data.error.message.toString();
                }
                return answer;
            }
            return {
                image: imageUrl,
                answerType: 'image',
                text: prompt
            };
        }
        const chatcontext = [
            {
                role: 'system',
                content: this.context
            }
        ];
        try {
            const messages = await history.build(chatcontext);
            console.log('Request chatGptMessages', messages);
            const completion = await this.api.chat.completions.create({
                model: 'gpt-4-1106-preview',
                messages,
                functions: this.functions,
                function_call: 'auto',
                user: id
            });
            console.log('ChatGPT full log', completion);
            if (completion.usage !== undefined && completion.usage !== null)
                await users.updateUsage(id, completion.usage);
            const message = completion.choices[0].message;
            if (message) {
                console.log('ChatGPT', message);
                await history.addAnswer(message);
                if (message.function_call) {
                    await (0, functions_1.handleFunctionCall)(id, message.function_call, username, this.language);
                    answer.answerType = 'function';
                    answer.text = '';
                }
                if (message.content !== undefined && message.content !== null)
                    answer.text = message.content;
            }
            return answer;
        }
        catch (error) {
            if (error?.response?.data?.error?.message !== undefined) {
                console.error('ChatGPT error', error.response.data.error.message);
                answer.text =
                    answer.text + ' : ' + error.response.data.error.message.toString();
            }
            else
                console.error('ChatGPT error', error);
            return answer;
        }
    }
    async image(msg, id, username, isArchetype = false) {
        const users = new users_1.default(process.env.DYNAMODB_TABLE);
        const errorMsg = 'ChatGPT error. Please try again in few minutes';
        let answer = {
            image: '',
            answerType: 'text',
            text: errorMsg,
        };
        let prompt = msg.substring(0, 999);
        let fullPrompt = msg;
        const art = isArchetype ? archetypes_1.dalle : archetypes_1.archetypes;
        const messages = [
            {
                role: 'system',
                content: isArchetype ? art : art + username
            },
            {
                role: 'user',
                content: msg
            }
        ];
        try {
            const completion = await this.api.chat.completions.create({
                model: 'gpt-4-1106-preview',
                messages,
                user: id
            });
            console.log('ChatGPT', completion.choices[0].message?.content);
            if (completion?.choices[0]?.message?.content !== undefined && completion?.choices[0]?.message?.content !== null) {
                fullPrompt = completion.choices[0].message.content;
                prompt = completion.choices[0].message.content.substring(0, 999);
            }
            await users.updateUsage(id, completion.usage);
            if (isArchetype && fullPrompt.length > 999) {
                const completion = await this.api.chat.completions.create({
                    model: 'gpt-4-1106-preview',
                    messages: [
                        {
                            role: 'system',
                            content: 'Maximum size of description should be strictly 1000 characters. Do not provide description with the size more than 1000 characters. Please shorten the user input so it would be not more than 1000 characters',
                        },
                        {
                            role: 'user',
                            content: fullPrompt
                        },
                    ],
                    user: id
                });
                if (completion?.choices[0]?.message?.content !== undefined &&
                    completion?.choices[0]?.message?.content !== null &&
                    completion?.usage !== undefined) {
                    prompt = completion.choices[0].message.content.substring(0, 999);
                    await users.updateUsage(id, completion.usage);
                }
            }
        }
        catch (err) {
            console.error(err);
        }
        console.log('Image prompt:', prompt);
        console.log('Image full prompt:', fullPrompt);
        let imageUrl = '';
        try {
            const imageParams = {
                model: "dall-e-3",
                n: 1,
                prompt,
                user: id
            };
            const image = await this.api.images.generate(imageParams);
            if (image?.data[0]?.url !== undefined)
                imageUrl = image.data[0].url;
            await users.updateImageUsage(id);
            console.log('Image result', imageUrl, image.data);
        }
        catch (error) {
            console.error('createImage error');
            if (error?.response?.data?.error?.message !== undefined &&
                error?.response?.data?.error?.message !== null) {
                console.error(error.response.data.error);
                answer.text =
                    errorMsg + ' : ' + error.response.data.error.message.toString();
            }
            return answer;
        }
        return {
            image: imageUrl,
            answerType: 'image',
            text: isArchetype ? archetypes_1.midjourney + fullPrompt : prompt,
        };
    }
}
exports.default = ChatGPTMessage;
//# sourceMappingURL=chatgpt.js.map