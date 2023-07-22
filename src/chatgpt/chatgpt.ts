import {
    Configuration,
    OpenAIApi,
    CreateChatCompletionRequest,
    ChatCompletionRequestMessageRoleEnum,
    ChatCompletionRequestMessage,
    CreateImageRequest,
} from "openai";
import ImageGPT from "../model/imageGPT";
import AIUsage from "../model/aiusage";
import DynamoDbConnector from "../connector/dynamoDbConnector";

interface InputParams extends CreateImageRequest {
    prompt: string; // make this mandatory for the function params
    user: string;
}

export default class ChatGPTMessage {
    api: OpenAIApi;
    context: string;

    constructor(token: string, context: string = "") {
        const configuration = new Configuration({
            //organization: "YOUR_ORG_ID",
            apiKey: token,
        });
        this.api = new OpenAIApi(configuration);
        this.context = context;
    }

    public async message(
        msg: string,
        parentMessage: string,
        id: string,
        image: string,
    ): Promise<ImageGPT> {
        const dbConnector = new DynamoDbConnector(process.env.DYNAMODB_TABLE!);
        const pMessage: string = parentMessage ? parentMessage : "";
        let isImage: boolean = false;
        let prompt = msg;
        const errorMsg = "ChatGPT error. Please try again in few minutes";
        let answer: ImageGPT = <ImageGPT>{
            image: "",
            answerType: "text",
            text: errorMsg,
        };
        if (image !== "") isImage = true;
        if (msg.length > 6 && msg.substr(0, 5).toLowerCase() === "image") {
            isImage = true;
            prompt = msg.substr(6);
        }
        if (msg.length > 9 && msg.substr(0, 8).toLowerCase() === "immagine") {
            isImage = true;
            prompt = msg.substr(9);
        }
        if (
            msg.length > 12 &&
            msg.substr(0, 11).toLowerCase() === "изображение"
        ) {
            isImage = true;
            prompt = msg.substr(12);
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
                        errorMsg +
                        " : " +
                        error.response.data.error.message.toString();
                }
                return answer;
            }
            /*  

  const response = await openai.createImageVariation(
    fs.createReadStream("image.png"),
    1,
    "1024x1024"
  );
  
  const buffer: Buffer = [your image data];
// Cast the buffer to `any` so that we can set the `name` property
const file: any = buffer;
// Set a `name` that ends with .png so that the API knows it's a PNG image
file.name = "image.png";
const response = await openai.createImageVariation(
  file,
  1,
  "1024x1024"
);
  */

            return <ImageGPT>{
                image: image_url,
                answerType: "image",
                text: prompt,
            };
        }
        const chatGptMessages =
            pMessage == ""
                ? [
                      {
                          role: ChatCompletionRequestMessageRoleEnum.Assistant,
                          content: this.context,
                      },
                      {
                          role: ChatCompletionRequestMessageRoleEnum.User,
                          content: msg,
                      },
                  ]
                : [
                      {
                          role: ChatCompletionRequestMessageRoleEnum.Assistant,
                          content: this.context,
                      },
                      {
                          role: ChatCompletionRequestMessageRoleEnum.User,
                          content: pMessage,
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
            )
                answer.text = completion.data.choices[0].message.content;
            await dbConnector.updateUsage(id, <AIUsage>completion.data.usage);
            return answer;
        } catch (err) {
            console.error(err);
            return answer;
        }
    }

    public async image(
        msg: string,
        parentMessage: string,
        id: string,
        username: string,
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

        const art: string = `You are a highly advanced AI model, DALL·E, capable of generating unique images from text descriptions. Based on the user's request, generate a detailed and creative description that will inspire you to create a compelling and imaginative image.
Utilize your understanding of Carl Jung's theory of archetypes to craft an image description that will profoundly connect with the user's emotions and intellect.
Maximum size of description should be strictly 1000 characters. Do not provide description with the size more than 1000 characters. 
The image will be used as NFT of the user `;
        const chatGptMessages =
            pMessage == ""
                ? [
                      {
                          role: ChatCompletionRequestMessageRoleEnum.Assistant,
                          content: art + username,
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
                          role: ChatCompletionRequestMessageRoleEnum.Assistant,
                          content: art + username,
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
            )
                prompt = completion.data.choices[0].message.content.substr(
                    0,
                    999,
                );
            await dbConnector.updateUsage(id, <AIUsage>completion.data.usage);
        } catch (err) {
            console.error(err);
        }

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
                    errorMsg +
                    " : " +
                    error.response.data.error.message.toString();
            }
            return answer;
        }

        return <ImageGPT>{
            image: image_url,
            answerType: "image",
            text: prompt,
        };
    }
}
