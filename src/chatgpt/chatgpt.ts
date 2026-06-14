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

    try {
      // Responses API: the system prompt goes in `instructions`, so the history
      // builds the conversation only. `input` accumulates Responses items
      // (messages + function_call/function_call_output/reasoning) for this turn.
      const input: any[] = await history.build([]);

      let needsReply = true;
      let count = 0;
      const toolsResults: AiData[] = [];
      let finalText = "";

      while (needsReply && count < 5) {
        count++;
        console.log("Request chatGptMessages count", count);
        const response = await this.api.responses.create({
          model: "gpt-5.5",
          instructions: this.context,
          input,
          tools: this.functions,
          reasoning: { effort: "medium" },
          // store:false keeps it stateless; encrypted reasoning lets the reasoning
          // items in `response.output` be re-submitted in the next loop iteration.
          include: ["reasoning.encrypted_content"],
          store: false,
          user: id,
        });
        //console.log("ChatGPT full log", response);

        if (response.usage !== undefined && response.usage !== null)
          await users.updateUsage(id, <AIUsage>{
            prompt_tokens: response.usage.input_tokens,
            completion_tokens: response.usage.output_tokens,
            total_tokens: response.usage.total_tokens,
          });

        // Carry reasoning + tool-call items forward (required with store: false).
        input.push(...response.output);

        const calls: any[] = response.output.filter(
          (item: any) => item.type === "function_call"
        );
        if (calls.length === 0) {
          needsReply = false;
        } else {
          for (const call of calls) {
            //console.log("ChatGPT tool", call.call_id, call.name);
            let reply: AiData | undefined = undefined;
            try {
              reply = await aiTool(id, call, this.language);
              reply.functionName = call.name;
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

            input.push({
              type: "function_call_output",
              call_id: call.call_id,
              output: reply.answer,
            });
          }
          answer.answerType = "function";
          answer.text = "";
        }

        if (response.output_text && response.output_text.length > 0) {
          finalText = response.output_text;
          answer.text = finalText;
          answer.answerType = "text";
        }
      }

      // Exhausted the tool-call cap without a final text reply — force a
      // text-only completion so the user is never left with silence.
      if (needsReply && finalText.length === 0) {
        try {
          const finalResponse = await this.api.responses.create({
            model: "gpt-5.5",
            instructions: this.context,
            input,
            tools: this.functions,
            tool_choice: "none",
            reasoning: { effort: "medium" },
            include: ["reasoning.encrypted_content"],
            store: false,
            user: id,
          });
          if (finalResponse.usage !== undefined && finalResponse.usage !== null)
            await users.updateUsage(id, <AIUsage>{
              prompt_tokens: finalResponse.usage.input_tokens,
              completion_tokens: finalResponse.usage.output_tokens,
              total_tokens: finalResponse.usage.total_tokens,
            });
          if (
            finalResponse.output_text &&
            finalResponse.output_text.length > 0
          ) {
            finalText = finalResponse.output_text;
            answer.text = finalText;
            answer.answerType = "text";
          }
        } catch (error) {
          console.error("ChatGPT final completion error", error);
        }
        if (finalText.length === 0) {
          answer.text = errorMsg;
          answer.answerType = "text";
        }
      }

      if (finalText.length > 0)
        await history.addAnswer({ role: "assistant", content: finalText });

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
          model: "gpt-5.5",
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
            model: "gpt-5.5",
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
      const imageParams: OpenAI.Images.ImageGenerateParams = {
        model: "gpt-image-2",
        n: 1,
        prompt,
        size: "1024x1024",
        user: id,
      };

      // gpt-image models always return base64 (b64_json), never a URL
      const image = await this.api.images.generate(imageParams);
      if (image?.data?.[0]?.b64_json !== undefined)
        imageUrl = image.data[0].b64_json;
      await users.updateImageUsage(id);
      console.log("Image result generated:", imageUrl !== "");
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
