import OpenAI from "openai";
import type ImageGPT from "../model/imageGPT";
import type AIUsage from "../model/aiusage";
import type { AiData } from "../model/aiData";
import Users from "../table/users";
import History from "../table/history";
import { aiTool, aiPostProcess } from "./functions";
import { archetypes, midjourney, dalle } from "./archetypes";
const HISTORY_TABLE = process.env.HISTORY_TABLE!;

export default class ChatGPTMessage {
  api: OpenAI;
  context: string;
  functions: any[];
  language: string;

  constructor(
    token: string,
    language: string,
    context: string = "",
    functions: any[] = []
  ) {
    this.api = new OpenAI({ apiKey: token });
    this.context = context;
    this.functions = functions;
    this.language = language;
  }

  public async message(id: string): Promise<ImageGPT> {
    const users = new Users(process.env.DYNAMODB_TABLE!);
    const history: History = new History(HISTORY_TABLE, id);

    const errorMsg = "ChatGPT error. Please try again in few minutes";
    let answer: ImageGPT = {
      image: "",
      answerType: "text",
      text: errorMsg,
    } as ImageGPT;
    /*
    let isImage: boolean = false;

    let prompt = message;
    let role = params.role === "system" ? "system" : "user";
    //if (image !== "") isImage = true;
    if (message.length > 6 && message.substr(0, 5).toLowerCase() === "image") {
      isImage = true;
      prompt = message.substr(6);
    }
    if (
      message.length > 9 &&
      message.substr(0, 8).toLowerCase() === "imagine"
    ) {
      isImage = true;
      prompt = message.substr(9);
    }

    if (isImage) {
      console.log("Image prompt:", prompt);
      let imageUrl = "";

      try {
        const imageParams = {
          n: 1,
          prompt,
          user: id,
        };

        const image = await this.api.images.generate(imageParams);
        if (image?.data[0]?.url !== undefined) imageUrl = image.data[0].url;
        await users.updateImageUsage(id);
        console.log("Image result", imageUrl, image.data);
      } catch (error: any) {
        console.error("createImage error");
        if (error?.response?.data?.error?.message !== undefined) {
          console.error(error.response.data.error);
          answer.text =
            errorMsg + " : " + error.response.data.error.message.toString();
        }
        return answer;
      }

      return {
        image: imageUrl,
        answerType: "image",
        text: prompt,
      } as ImageGPT;
    }
    */

    const chatcontext = [
      {
        role: "system",
        content: this.context,
      },
    ];

    try {
      const messages = await history.build(chatcontext);
      console.log("ChatGPT messages", messages);

      let needsReply = true;
      let count = 0;
      const toolsResults: AiData[] = [];
      let message: OpenAI.Chat.Completions.ChatCompletionMessage | undefined =
        undefined;

      while (needsReply && count < 5) {
        count++;
        console.log("Request chatGptMessages count", count);
        //console.log("Request chatGptMessages", messages);
        const completion = await this.api.chat.completions.create({
          model: "gpt-4o",
          messages,
          tools: this.functions,
          user: id,
        });
        console.log("ChatGPT full log", completion);

        if (completion.usage !== undefined && completion.usage !== null)
          await users.updateUsage(id, completion.usage as AIUsage);
        message = completion.choices[0].message;
        if (message) {
          //console.log("ChatGPT", message);
          await history.addAnswer(message);

          if (message.tool_calls === undefined) {
            needsReply = false;
          } else {
            messages.push(message);
            for (const tool of message.tool_calls) {
              //console.log("ChatGPT tool", tool.id, tool.function);
              let reply: AiData | undefined = undefined;
              try {
                reply = await aiTool(id, tool.function, this.language);
                reply.functionName = tool.function.name;
                toolsResults.push(reply);
              } catch (error) {
                console.error("ChatGPT handleFunctionCall", error);
              }
              if (reply === undefined)
                reply = <AiData>{
                  answer: "Function error",
                  needsPostProcessing: false,
                  data: {},
                  message: "ChatGPT function error",
                  messageParams: {},
                  support: undefined,
                };

              const replyMessage = {
                tool_call_id: tool.id,
                role: "tool",
                name: tool.function.name,
                content: reply.answer,
              };
              //console.log("ChatGPT replyMessage", replyMessage);
              await history.addAnswer(replyMessage);
              messages.push(replyMessage);
            }
            answer.answerType = "function";
            answer.text = "";
          }

          if (message.content !== undefined && message.content !== null) {
            answer.text = message.content;
            answer.answerType = "text";
          }
        }
      }
      await aiPostProcess(toolsResults, answer.text);
      return answer;
    } catch (error: any) {
      if (error?.response?.data?.error?.message !== undefined) {
        console.error("ChatGPT error", error.response.data.error.message);
        answer.text =
          answer.text + " : " + error.response.data.error.message.toString();
      } else console.error("ChatGPT error", error);
      return answer;
    }
  }

  public async image(
    msg: string,
    id: string,
    //username: string,
    isArchetype: boolean = false,
    ai: boolean = false
  ): Promise<ImageGPT> {
    const users = new Users(process.env.DYNAMODB_TABLE!);
    const errorMsg = "ChatGPT error. Please try again in few minutes";
    let answer: ImageGPT = <ImageGPT>{
      image: "",
      answerType: "text",
      text: errorMsg,
    };
    let prompt: string = msg.substring(0, 999);
    let fullPrompt: string = msg;

    if (ai === false) {
      const art: string = isArchetype ? dalle : archetypes;
      const messages: any[] = [
        {
          role: "system",
          content: art,
        },
        {
          role: "user",
          content: msg,
        },
      ];

      try {
        const completion = await this.api.chat.completions.create({
          model: "gpt-4o", // "gpt-3.5-turbo"
          messages,
          user: id,
        });
        console.log("ChatGPT", completion.choices[0].message?.content);
        if (
          completion?.choices[0]?.message?.content !== undefined &&
          completion?.choices[0]?.message?.content !== null
        ) {
          fullPrompt = completion.choices[0].message.content;
          prompt = completion.choices[0].message.content.substring(0, 999);
        }
        await users.updateUsage(id, completion.usage as AIUsage);
        if (isArchetype && fullPrompt.length > 999) {
          const completion = await this.api.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "Maximum size of description should be strictly 1000 characters. Do not provide description with the size more than 1000 characters. Please shorten the user input so it would be not more than 1000 characters",
              },
              {
                role: "user",
                content: fullPrompt,
              },
            ],
            user: id,
          });
          if (
            completion?.choices[0]?.message?.content !== undefined &&
            completion?.choices[0]?.message?.content !== null &&
            completion?.usage !== undefined
          ) {
            prompt = completion.choices[0].message.content.substring(0, 999);
            await users.updateUsage(id, completion.usage as AIUsage);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    console.log("Image prompt:", prompt);
    console.log("Image full prompt:", fullPrompt);
    let imageUrl = "";

    try {
      const imageParams = {
        model: "dall-e-3",
        n: 1,
        prompt,
        user: id,
      };

      const image = await this.api.images.generate(imageParams);
      if (image?.data[0]?.url !== undefined) imageUrl = image.data[0].url;
      await users.updateImageUsage(id);
      console.log("Image result", imageUrl, image.data);
    } catch (error: any) {
      console.error("createImage error", error);
      if (
        error?.error?.message !== undefined &&
        error?.error?.message !== null
      ) {
        console.error("Full image creation error:", error);
        console.error("Image creating error message:", error.error.message);
        answer.text = errorMsg + " : " + error.error.message.toString();
      } else answer.text = errorMsg + ": " + fullPrompt;
      return answer;
    }

    return <ImageGPT>{
      image: imageUrl,
      answerType: "image",
      text: isArchetype ? midjourney + fullPrompt : prompt,
    };
  }
}
