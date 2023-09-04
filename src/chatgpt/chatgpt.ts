import {
  Configuration,
  OpenAIApi,
  CreateChatCompletionRequest,
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionRequestMessage,
  CreateImageRequest,
  ChatCompletionFunctions,
} from "openai";
import ImageGPT from "../model/imageGPT";
import AIUsage from "../model/aiusage";
import DynamoDbConnector from "../connector/dynamoDbConnector";
import HistoryData from "../model/historyData";
import History from "../connector/history";
import { handleFunctionCall } from "./functions";
import { archetypes, midjourney, dalle } from "./archetypes";
const HISTORY_TABLE = process.env.HISTORY_TABLE!;

interface InputParams extends CreateImageRequest {
  prompt: string; // make this mandatory for the function params
  user: string;
}

export default class ChatGPTMessage {
  api: OpenAIApi;
  context: string;
  functions: ChatCompletionFunctions[];

  constructor(
    token: string,
    context: string = "",
    functions: ChatCompletionFunctions[] = [],
  ) {
    const configuration = new Configuration({
      //organization: "YOUR_ORG_ID",
      apiKey: token,
    });
    this.api = new OpenAIApi(configuration);
    this.context = context;
    this.functions = functions;
  }

  public async message(params: any): Promise<ImageGPT> {
    const { message, parentMessage, id, image, function_call, role, username } =
      params;

    const dbConnector = new DynamoDbConnector(process.env.DYNAMODB_TABLE!);
    const history: History = new History(HISTORY_TABLE, id);
    const pMessage: string = parentMessage ? parentMessage : "";
    let isImage: boolean = false;

    let prompt = message;
    const errorMsg = "ChatGPT error. Please try again in few minutes";
    let answer: ImageGPT = <ImageGPT>{
      image: "",
      answerType: "text",
      text: errorMsg,
    };
    if (image !== "") isImage = true;
    if (message.length > 6 && message.substr(0, 5).toLowerCase() === "image") {
      isImage = true;
      prompt = message.substr(6);
    }
    if (
      message.length > 9 &&
      message.substr(0, 8).toLowerCase() === "immagine"
    ) {
      isImage = true;
      prompt = message.substr(9);
    }

    if (isImage) {
      console.log("Image prompt:", prompt);
      let image_url = "";

      try {
        const defaultImageParams: CreateImageRequest = {
          n: 1,
          prompt,
        };

        const inputParams: InputParams = <InputParams>{
          n: 1,
          prompt,
          user: id,
        };

        const response = await this.api.createImage({
          ...defaultImageParams,
          ...inputParams,
        });
        if (
          response &&
          response.data &&
          response.data.data &&
          response.data.data[0].url
        )
          image_url = response.data.data[0].url;
        await dbConnector.updateImageUsage(id);
        console.log("Image result", image_url, response.data);
      } catch (error: any) {
        console.error("createImage error");
        if (
          error &&
          error.response &&
          error.response.data &&
          error.response.data.error &&
          error.response.data.error.message
        ) {
          console.error(error.response.data.error);
          answer.text =
            errorMsg + " : " + error.response.data.error.message.toString();
        }
        return answer;
      }

      return <ImageGPT>{
        image: image_url,
        answerType: "image",
        text: prompt,
      };
    }

    const chatcontext: ChatCompletionRequestMessage[] = [
      {
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        content: this.context,
      },
    ];

    const request: ChatCompletionRequestMessage[] =
      role == "assistant"
        ? [
            {
              role: ChatCompletionRequestMessageRoleEnum.Assistant,
              content: message,
            },
          ]
        : [];

    try {
      const messages: ChatCompletionRequestMessage[] = await history.build(
        chatcontext,
        request,
      );
      console.log("Request chatGptMessages", messages);

      const completion = await this.api.createChatCompletion({
        model: "gpt-4", // "gpt-3.5-turbo"
        messages,
        functions: this.functions,
        function_call: function_call ? { name: function_call } : undefined,
        user: id,
      });
      console.log("ChatGPT full log", completion.data);

      if (completion.data.usage)
        await dbConnector.updateUsage(id, <AIUsage>completion.data.usage);
      const message: ChatCompletionRequestMessage | undefined = <
        ChatCompletionRequestMessage
      >completion.data.choices[0].message;
      if (message) {
        console.log("ChatGPT", message);
        await history.addAnswer(
          <ChatCompletionRequestMessage>completion.data.choices[0].message,
        );
        if (message.function_call) {
          await handleFunctionCall(id, message.function_call, username);
          answer.answerType = "function";
          answer.text = "";
        }
        if (message.content) answer.text = message.content;
      }

      return answer;
    } catch (error: any) {
      if (error.response.data.error.message) {
        console.error("ChatGPT error", error.response.data.error.message);
        answer.text =
          answer.text + " : " + error.response.data.error.message.toString();
      } else console.error("ChatGPT error", error);
      return answer;
    }
  }

  public async image(
    msg: string,
    parentMessage: string,
    id: string,
    username: string,
    isArchetype: boolean = false,
  ): Promise<ImageGPT> {
    const dbConnector = new DynamoDbConnector(process.env.DYNAMODB_TABLE!);
    const pMessage: string = parentMessage ? parentMessage : "";
    let isImage: boolean = false;

    const errorMsg = "ChatGPT error. Please try again in few minutes";
    let answer: ImageGPT = <ImageGPT>{
      image: "",
      answerType: "text",
      text: errorMsg,
    };
    let prompt: string = msg.substr(0, 999);
    let fullPrompt: string = msg;

    const art: string = isArchetype ? dalle : archetypes;
    const chatGptMessages =
      pMessage == ""
        ? [
            {
              role: ChatCompletionRequestMessageRoleEnum.System,
              content: isArchetype ? art : art + username,
            },
            {
              role: ChatCompletionRequestMessageRoleEnum.User,
              content: msg,
            },
          ]
        : [
            {
              role: ChatCompletionRequestMessageRoleEnum.User,
              content: pMessage,
            },
            {
              role: ChatCompletionRequestMessageRoleEnum.System,
              content: isArchetype ? art : art + username,
            },
            {
              role: ChatCompletionRequestMessageRoleEnum.User,
              content: msg,
            },
          ];

    try {
      const completion = await this.api.createChatCompletion({
        model: "gpt-4", // "gpt-3.5-turbo"
        messages: chatGptMessages,
        user: id,
      });
      console.log("ChatGPT", completion.data.choices[0].message?.content);
      if (
        completion.data.choices[0].message &&
        completion.data.choices[0].message.content &&
        completion.data.usage
      ) {
        fullPrompt = completion.data.choices[0].message.content;
        prompt = completion.data.choices[0].message.content.substr(0, 999);
      }
      await dbConnector.updateUsage(id, <AIUsage>completion.data.usage);
      if (isArchetype && fullPrompt.length > 999) {
        const completion = await this.api.createChatCompletion({
          model: "gpt-4", // "gpt-3.5-turbo"
          messages: [
            {
              role: ChatCompletionRequestMessageRoleEnum.System,
              content:
                "Maximum size of description should be strictly 1000 characters. Do not provide description with the size more than 1000 characters. Please shorten the user input so it would be not more than 1000 characters",
            },
            {
              role: ChatCompletionRequestMessageRoleEnum.User,
              content: fullPrompt,
            },
          ],
          user: id,
        });
        if (
          completion.data.choices[0].message &&
          completion.data.choices[0].message.content &&
          completion.data.usage
        ) {
          prompt = completion.data.choices[0].message.content.substr(0, 999);
          await dbConnector.updateUsage(id, <AIUsage>completion.data.usage);
        }
      }
    } catch (err) {
      console.error(err);
    }

    console.log("Image prompt:", prompt);
    console.log("Image full prompt:", fullPrompt);
    let image_url = "";

    try {
      const defaultImageParams: CreateImageRequest = {
        n: 1,
        prompt,
      };

      const inputParams: InputParams = <InputParams>{
        n: 1,
        prompt,
        user: id,
      };

      const response = await this.api.createImage({
        ...defaultImageParams,
        ...inputParams,
      });
      if (
        response &&
        response.data &&
        response.data.data &&
        response.data.data[0].url
      )
        image_url = response.data.data[0].url;
      await dbConnector.updateImageUsage(id);
      console.log("Image result", image_url, response.data);
    } catch (error: any) {
      console.error("createImage error");
      if (
        error &&
        error.response &&
        error.response.data &&
        error.response.data.error &&
        error.response.data.error.message
      ) {
        console.error(error.response.data.error);
        answer.text =
          errorMsg + " : " + error.response.data.error.message.toString();
      }
      return answer;
    }

    return <ImageGPT>{
      image: image_url,
      answerType: "image",
      text: isArchetype ? midjourney + fullPrompt : prompt,
    };
  }
}
