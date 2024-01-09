import BotMessage from "../mina/message";
import Names from "../table/names";
import type { NamesData } from "../model/namesData";
import { FileData } from "../model/fileData";
import OwnersTable from "../table/owners";
import { FilesTable } from "../table/files";
import type { AiData } from "../model/aiData";
import { algoliaWriteToken } from "../nft/algolia";
import { botCommandList } from "../payments/botcommands";
import { description } from "./context";
import callLambda from "../lambda/lambda";
import { listKeys as listPrivateKeys } from "../mina/deploy";
import { getVoice, setVoice } from "../lang/lang";
import { getFormattedDateTime } from "../nft/nft";

const NAMES_TABLE = process.env.TESTWORLD2_NAMES_TABLE!;
const FILES_TABLE = process.env.FILES_TABLE!;
/*
get names of nft
get keys of nft
add post + image
add key-value pairs
sell nft
prove keys
verify keys
*/

const currencies: string[] = ["USD", "EUR", "GBP", "CAD", "JPY"];
const nft_names: string[] = [];

/*
[
      {
        "type": "function",
        "function": {
          "name": "get_current_weather",
          "description": "Get the current weather in a given location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA",
              },
              "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
            },
            "required": ["location"],
          },
        }
      }
  ];
*/

const aiFunctions = {
  description: {
    type: "function",
    function: {
      name: "description",
      description:
        "Get the description of the Mina NFT project and its features",
    },
  },
  get_voice: {
    type: "function",
    function: {
      name: "get_voice",
      description:
        "Get the current status of voice messages. If on, every assistant's message will be converted to voice and sent to user",
    },
  },
  list_NFTs: {
    type: "function",
    function: {
      name: "list_NFTs",
      description: "List names of NFTs owned by user",
    },
  },
  list_files: {
    type: "function",
    function: {
      name: "list_files",
      description: "List files (including images) uploaded by user",
    },
  },
  set_voice: {
    type: "function",
    function: {
      name: "set_voice",
      description:
        "Sets the status of voice messages. If true, every assistant's message will be converted to voice and sent to user",
      parameters: {
        type: "object",
        properties: {
          isVoiceEnabled: {
            type: "boolean",
            description:
              "Set to true to enable voice messages and to false to disable voice messages",
          },
        },
      },
    },
  },
  generate_image: {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate am image using DALL-E based on description and save it to user's files",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description:
              "The description of the image to be generated by DALL-E. Maximum 999 characters. Please ask the user to provide the description of the image to be generated by DALL-E.",
          },
        },
      },
    },
  },
  view: {
    type: "function",
    function: {
      name: "view",
      description: "Shows to the user all NFTs or NFT with specific name",
      parameters: {
        type: "object",
        properties: {
          nft_name: {
            type: "string",
            description: "Mina NFT avatar name to view",
          },
        },
      },
    },
  },
  sell: {
    type: "function",
    function: {
      name: "sell",
      description: "Sell user's NFT for money",
      parameters: {
        type: "object",
        properties: {
          nft_name: {
            type: "string",
            description: "The name of the nft",
            enum: nft_names,
          },
          price: {
            type: "integer",
            description: "The sale price of NFT",
          },
          currency: {
            type: "string",
            description: "The currency of sale",
            enum: currencies,
          },
        },
        required: ["price", "currency"],
      },
    },
  },
  post: {
    type: "function",
    function: {
      name: "post",
      description: "Create post for user's NFT",
      parameters: {
        type: "object",
        properties: {
          nft_name: {
            type: "string",
            description: "The name of the NFT",
            enum: nft_names,
          },
          post_name: {
            type: "string",
            description: "The name of the post, maximum 30 characters",
          },
          post_description: {
            type: "string",
            description: "The post description, can be long",
          },
        },
        required: ["nft_name", "post_name"],
      },
    },
  },
  create_nft: {
    type: "function",
    function: {
      name: "create_nft",
      description:
        "Create new NFT. You should ask the user about all the parameters of the NFT and then call this function. Do not call this function without getting user's confirmation on all the parameters",
      parameters: {
        type: "object",
        properties: {
          nft_name: {
            type: "string",
            description:
              "The name of the NFT. Must be less than 30 characters, start with @ and contain only letters, numbers and _",
          },
          nft_image: {
            type: "string",
            description:
              "The filename of the image to be used as NFT avatar. Must be one of the files uploaded by the user and have image mime type",
          },
          nft_description: {
            type: "string",
            description: "The NFT description, can be long",
          },
          keys: {
            type: "array",
            description: "array of key-value pairs",
            items: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description:
                    "The key of the key-value pair, maximum 30 characters",
                },
                value: {
                  type: "string",
                  description:
                    "The value of the key-value pair, maximum 30 characters",
                },
                isPrivate: {
                  type: "boolean",
                  description:
                    "If this key is private, only the owner can see it",
                },
              },
            },
          },
          files: {
            type: "array",
            description: "array of filenames",
            items: {
              type: "object",
              properties: {
                filename: {
                  type: "string",
                  description:
                    "The filename of the file. Must be one of the files uploaded by the use. Can have any mime type",
                },
              },
            },
          },
        },
        required: ["nft_name", "nft_image"],
      },
    },
  },
  listKeys: {
    type: "function",
    function: {
      name: "listKeys",
      description: "List key value pairs for user's NFT",
      parameters: {
        type: "object",
        properties: {
          nft_name: {
            type: "string",
            description: "The name of the NFT",
            enum: nft_names,
          },
        },
        required: ["nft_name"],
      },
    },
  },
  edit: {
    type: "function",
    function: {
      name: "edit",
      description:
        "Add to the NFT owned by the user a public or private key-values pairs",
      parameters: {
        type: "object",
        properties: {
          nft_name: {
            type: "string",
            description: "The name of the nft",
            enum: nft_names,
          },
          keys: {
            type: "array",
            description: "array of key-value pairs",
            items: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description:
                    "The key of the key-value pair, maximum 30 characters",
                },
                value: {
                  type: "string",
                  description:
                    "The value of the key-value pair, maximum 30 characters",
                },
                isPrivate: {
                  type: "boolean",
                  description:
                    "If this key is private, only the owner can see it",
                },
              },
            },
          },
        },
        required: ["nft_name", "keyvalue"],
      },
    },
  },
};

async function getAIfunctions(id: string): Promise<any[]> {
  const functions = [];
  functions.push(aiFunctions.description);
  functions.push(aiFunctions.get_voice);
  functions.push(aiFunctions.set_voice);
  functions.push(aiFunctions.create_nft);
  functions.push(aiFunctions.generate_image);
  const owners = new OwnersTable(process.env.OWNERS_TABLE!);
  const names: string[] = await owners.listNFTs(id);
  if (names.length > 0) {
    functions.push(aiFunctions.list_NFTs);
    functions.push(aiFunctions.list_files);
    functions.push(aiFunctions.view);
    const sell = aiFunctions.sell;
    sell.function.parameters.properties.nft_name.enum = names;
    functions.push(aiFunctions.sell);
    const post = aiFunctions.post;
    post.function.parameters.properties.nft_name.enum = names;
    functions.push(post);
    const edit = aiFunctions.edit;
    edit.function.parameters.properties.nft_name.enum = names;
    functions.push(edit);
    const listKeys = aiFunctions.listKeys;
    listKeys.function.parameters.properties.nft_name.enum = names;
    functions.push(listKeys);
  }
  return functions;
}

async function getDescription(): Promise<AiData> {
  return <AiData>{
    answer: description,
    needsPostProcessing: false,
  };
}

async function get_voice(id: string): Promise<AiData> {
  const voice = await getVoice(id);
  return <AiData>{
    answer: voice === true ? "Voice is enabled" : "Voice is disabled",
    needsPostProcessing: false,
  };
}

async function set_voice(id: string, request: any): Promise<AiData> {
  console.log("set_voice", id, JSON.stringify(request, null, 2));
  const voice = request.isVoiceEnabled === true ? true : false;
  await setVoice(id, voice);
  return <AiData>{
    answer:
      voice === true ? "Voice is set to enabled" : "Voice is set to disabled",
    needsPostProcessing: false,
  };
}

async function generate_image(id: string, request: any): Promise<AiData> {
  console.log("generate_image", id, JSON.stringify(request, null, 2));
  const description = request.description;
  return <AiData>{
    answer:
      description === undefined
        ? "Error genrating image. Please provide the description of the image to be generated by DALL-E"
        : "Image generation is started. Please wait a few minutes. We will notify the user you when it is done",
    needsPostProcessing: true,
    data: { id, description },
  };
}

async function list_NFTs(id: string): Promise<AiData> {
  const owners = new OwnersTable(process.env.OWNERS_TABLE!);
  const names: string[] = await owners.listNFTs(id);

  return <AiData>{
    answer:
      names.length === 0
        ? "No NFTs that can be managed in the telegram bot owned by the user. Please ask the user to manage his NFTs in the web app www.minanft.io"
        : JSON.stringify(names),
    needsPostProcessing: false,
  };
}

async function list_files(id: string): Promise<AiData> {
  const filesTable = new FilesTable(FILES_TABLE);
  const files: FileData[] = await filesTable.listFiles(id);
  const data = files.map((file) => {
    return {
      filename: file.filename,
      sizeInBytes: file.size,
      mimeType: file.mimeType,
      timeUploaded: getFormattedDateTime(file.timeUploaded),
    };
  });
  console.log("list_files", data);

  return <AiData>{
    answer:
      files.length === 0
        ? "No files uploaded by the user"
        : JSON.stringify(data),
    needsPostProcessing: false,
  };
}

async function create_nft(
  id: string,
  request: any,
  language: string
): Promise<AiData> {
  console.log("create_nft", JSON.stringify(request, null, 2));

  return <AiData>{
    answer:
      "NFT creation is started. Please wait a few minutes. We will notify the user you when it is done",
    needsPostProcessing: true,
    data: { id, request, language },
  };
}

async function edit(
  id: string,
  request: any,
  language: string
): Promise<AiData> {
  console.log("edit", id, JSON.stringify(request, null, 2));
  let success = true;
  let answer =
    "The addition of the key-value pairs have been started. Please wait a few minutes. We will notify the user you when it is done";
  if (request.nft_name && request.keys && request.keys.length > 0) {
    const names = new Names(NAMES_TABLE);
    const name: NamesData | undefined = await names.get({
      username: request.nft_name,
    });
    if (name === undefined) {
      console.error("Error: nft is not found", request.nft_name);
      success = false;
      answer = "Error: NFT is not found";
    } else if (name.id !== id) {
      console.error("Error: nft is not owned by the user", request.nft_name);
      success = false;
      answer = "Error: NFT is not owned by the user";
    } else if (
      name.ownerPrivateKey === undefined ||
      name.ownerPrivateKey === ""
    ) {
      console.error("Error: owner key is empty", request.nft_name);
      success = false;
      answer =
        "Error: This NFT does not have owner key. The user should use minanft.io to manage it";
    }
  } else {
    success = false;
    answer =
      "Please provide the name of the NFT and the key-value pairs. The provided data is not valid";
  }

  /*
export async function addKeys(params: {
  id: string;
  username: string;
  keys: { key: string; value: string; isPrivate: boolean }[];
  language: string;
}): Promise<void> {
  */
  const data = {
    id,
    username: request.nft_name,
    keys: request.keys,
    language,
  };

  return <AiData>{
    answer,
    needsPostProcessing: success ? true : false,
    data: success ? data : {},
  };
}

async function post(
  id: string,
  request: any,
  username: string | undefined,
  language: string
): Promise<AiData> {
  return <AiData>{
    answer:
      "Ask the user to upload an image or describe the image to be created by DALL-E",
    needsPostProcessing: false,
    data: {},
    message: JSON.stringify(request),
    messageParams: {},
    support: undefined,
  };
}

async function view(
  id: string,
  request: any,
  username: string,
  language: string
): Promise<AiData> {
  return <AiData>{
    answer: "view successfull",
    needsPostProcessing: false,
    data: {},
    message: JSON.stringify(request),
    messageParams: {},
    support: undefined,
  };
}

async function sell(
  id: string,
  request: any,
  username: string,
  language: string
): Promise<AiData> {
  return <AiData>{
    answer: "sell successfull",
    needsPostProcessing: false,
    data: {},
    message: JSON.stringify(request),
    messageParams: {},
    support: undefined,
  };
}

async function listKeys(
  id: string,
  request: any,
  username: string,
  language: string
): Promise<AiData> {
  console.log("listKeys", id, JSON.stringify(request, null, 2));
  let answer = "Error listing keys";
  if (request.nft_name !== undefined && request.nft_name !== "") {
    const keys = await listPrivateKeys({
      id,
      username: request.nft_name,
      language,
    });
    console.log("listKeys keys", keys);
    if (keys !== undefined && keys.length !== 0) answer = JSON.stringify(keys);
    else if (keys !== undefined) answer = "No keys found";
  } else answer = "Please provide the name of the NFT";
  console.log("listKeys answer", answer);

  return <AiData>{
    answer,
    needsPostProcessing: false,
  };
}

async function aiTool(
  id: string,
  tool: any,
  username: string,
  language: string
) {
  console.log("aiTool", id, tool, username, language);
  const request = JSON.parse(tool.arguments);
  const name = tool.name;
  switch (name) {
    case "edit":
      return await edit(id, request, language);
    case "post":
      return await post(id, request, username, language);
    case "view":
      return await view(id, request, username, language);
    case "sell":
      return await sell(id, request, username, language);
    case "list_NFTs":
      return await list_NFTs(id);
    case "list_files":
      return await list_files(id);
    case "create_nft":
      return await create_nft(id, request, language);
    case "generate_image":
      return await generate_image(id, request);
    case "description":
      return await getDescription();
    case "listKeys":
      return await listKeys(id, request, username, language);
    case "get_voice":
      return await get_voice(id);
    case "set_voice":
      return await set_voice(id, request);
    default:
      console.error("ChatGPT aiTool - wrong function name", name);
      return <AiData>{
        answer: "Function error - wrong function name",
        needsPostProcessing: false,
      };
  }
}

async function editPostProcess(data: any) {
  console.log("editPostProcess", JSON.stringify(data, null, 2));
  await callLambda("addkeys", JSON.stringify(data));
  await sleep(1000);
  return;
}

async function create_nftPostProcess(data: any) {
  console.log("create_nftPostProcess", JSON.stringify(data, null, 2));
  //await callLambda("addkeys", JSON.stringify(data));
  await sleep(1000);
  return;
}

async function generate_imagePostProcess(data: any) {
  console.log("generate_imagePostProcess", JSON.stringify(data, null, 2));
  await callLambda(
    "image",
    JSON.stringify({
      id: data.id,
      message: data.description,
      username: "",
      creator: "DALL-E",
      image: "",
      ai: "true",
      auth: process.env.CHATGPTPLUGINAUTH!,
    })
  );
  await sleep(1000);
  return;
}

async function aiPostProcess(results: AiData[], answer: string) {
  //console.log("aiPostProcess", results);
  for (const result of results) {
    if (result.needsPostProcessing) {
      const functionName = result.functionName;
      const data = result.data;
      switch (functionName) {
        case "edit":
          await editPostProcess(data);
          break;
        case "create_nft":
          await create_nftPostProcess(data);
          break;
        case "generate_image":
          await generate_imagePostProcess(data);
          break;
        default:
          break;
      }
    }
  }

  return;
}

async function handleFunctionCall(
  id: string,
  message: any,
  username: string | undefined,
  language: string
): Promise<string> {
  console.log("handleFunctionCall", id, message, username, language);
  if (message && message.name) {
    try {
      const request = JSON.parse(message.arguments);
      const bot = new BotMessage(id, language);
      console.log("Function request", request);

      if (message.name == "view") {
        console.log("Function view:", request);
        if (request.nft_name)
          await bot.tmessage("letmeshowyou", {
            nftname: "NFT" + request.nft_name,
          });
        else await bot.tmessage("letmeshowyouall");
        await botCommandList(id, language, request.nft_name);
        return "User have got the list of NFTs";
      }

      if (message.name == "post") {
        console.log("Function post:", request);
        await bot.message(
          `Post function: ${JSON.stringify(request, null, 2)} `
        );
        return "Post have been created";
      }

      if (message.name == "edit") {
        console.log("Function edit:", request);
        await bot.message(
          `Edit function: ${JSON.stringify(request, null, 2)} `
        );
        return "NFT have been edited";
      }

      if (message.name == "sell") {
        console.log("Function sell:", request);
        if (request.price && request.currency) {
          if (
            currencies.includes(request.currency) &&
            username &&
            username !== "" &&
            Number(request.price)
          ) {
            const names = new Names(NAMES_TABLE);
            //  "sellingnftforcurrencyprice": "Selling NFT {{name}} for {{currency}} {{price}}"
            await bot.tmessage("sellingnftforcurrencyprice", {
              name: username ? username.replaceAll("@", "") : "",
              currency: request.currency,
              price: request.price,
            });
            await names.sell(username, Number(request.price), request.currency);
            console.log("Before sleep");
            await sleep(5000);
            console.log("After sleep");
            const nft: NamesData | undefined = await names.get({ username });
            console.log("NFT sale handleFunctionCall", nft);
            if (nft && nft.onSale == true) await algoliaWriteToken(nft);
            else console.error("Error NFT sale handleFunctionCall");
          }
          // "cannotsellnftforcurrencyprice": "Cannot sell NFT {{name}} for {{currency}} {{price}}"
          else
            await bot.tmessage("cannotsellnftforcurrencyprice", {
              name: username ? username.replaceAll("@", "") : "",
              currency: request.currency,
              price: request.price,
            });
          return "NFT have been sold";
        }
      }
    } catch (err) {
      console.error("Function error:", err);
      return "Function error";
    }
  }
  return "Function error";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { getAIfunctions, handleFunctionCall, aiTool, aiPostProcess };
