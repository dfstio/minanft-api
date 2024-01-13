import Names from "../table/names";
import type { NamesData, BotMintData, KeyData } from "../model/namesData";
import { FileData } from "../model/fileData";
import OwnersTable from "../table/owners";
import { FilesTable } from "../table/files";
import type { AiData } from "../model/aiData";
import { algoliaWriteToken } from "../nft/algolia";
import { description } from "./context";
import callLambda from "../lambda/lambda";
import { listKeys as listPrivateKeys } from "../mina/deploy";
import { getVoice, setVoice } from "../lang/lang";
import { getFormattedDateTime, startDeployment } from "../nft/nft";

const NAMES_TABLE = process.env.TESTWORLD2_NAMES_TABLE!;
const FILES_TABLE = process.env.FILES_TABLE!;

const currencies: string[] = ["USD", "EUR", "GBP", "CAD", "JPY"];
const nft_names: string[] = [];

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
  create_post: {
    type: "function",
    function: {
      name: "create_post",
      description:
        "Create new post for existing user's NFT. You should ask the user about all the parameters of the post and then call this function. Do not call this function without getting user's confirmation on all the parameters",
      parameters: {
        type: "object",
        properties: {
          nft_name: {
            type: "string",
            description:
              "The name of the existing user's NFT where the post will be added.",
            enum: nft_names,
          },
          post_name: {
            type: "string",
            description: "The name of the post, maximum 30 characters",
          },
          post_image: {
            type: "string",
            description:
              "The filename of the image to be used as NFT avatar. Must be one of the files uploaded by the user and have image mime type",
          },
          post_description: {
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
              filename: {
                type: "string",
                description:
                  "The filename of the file. Must be one of the files uploaded by the user. Can have any mime type",
              },
            },
          },
        },
        required: ["nft_name", "post_name", "post_image"],
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
              filename: {
                type: "string",
                description:
                  "The filename of the file. Must be one of the files uploaded by the user. Can have any mime type",
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
  add_keys: {
    type: "function",
    function: {
      name: "add_keys",
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
        required: ["nft_name", "keys"],
      },
    },
  },
  prove: {
    type: "function",
    function: {
      name: "prove",
      description: "Generate ZK proof for public or private key-values pairs",
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
            description: "array of NFTs keys",
            items: {
              type: "string",
              description:
                "The key of the key-value pair. Should be the key of the NFT returned by the listKeys function",
            },
          },
        },
        required: ["nft_name", "keys"],
      },
    },
  },
  verify: {
    type: "function",
    function: {
      name: "verify",
      description:
        "Verifies the ZK proof for public or private key-values pairs",
      parameters: {
        type: "object",
        properties: {
          proofFilename: {
            type: "string",
            description:
              "Filename of the ZK proof json file. Should be one of the files of the user, ends with .proof.json and have application/json mime type",
          },
        },
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
  functions.push(aiFunctions.verify);
  const owners = new OwnersTable(process.env.OWNERS_TABLE!);
  const names: string[] = await owners.listNFTs(id);
  if (names.length > 0) {
    functions.push(aiFunctions.list_NFTs);
    functions.push(aiFunctions.list_files);
    const sell = aiFunctions.sell;
    sell.function.parameters.properties.nft_name.enum = names;
    functions.push(aiFunctions.sell);
    const post = aiFunctions.create_post;
    post.function.parameters.properties.nft_name.enum = names;
    functions.push(post);
    const add_keys = aiFunctions.add_keys;
    add_keys.function.parameters.properties.nft_name.enum = names;
    functions.push(add_keys);
    const listKeys = aiFunctions.listKeys;
    listKeys.function.parameters.properties.nft_name.enum = names;
    functions.push(listKeys);
    const prove = aiFunctions.prove;
    prove.function.parameters.properties.nft_name.enum = names;
    functions.push(prove);
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
        ? "Error generating image. Please provide the description of the image to be generated by DALL-E"
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
  const nameValidation = await validateNewName(id, request.nft_name);
  const filesValidation = await validateFiles(id, request.files);
  const validated = nameValidation.validated && filesValidation.validated;
  const answer = validated
    ? "NFT creation is started. Please wait a few minutes. We will notify the user you when it is done"
    : nameValidation.reason ?? filesValidation.reason ?? "Error creating NFT";

  return <AiData>{
    answer,
    needsPostProcessing: validated ? true : false,
    data: validated ? { id, request, language } : {},
  };
}

async function create_post(
  id: string,
  request: any,
  language: string
): Promise<AiData> {
  console.log("create_post", JSON.stringify(request, null, 2));
  const nameValidation = await validateName(id, request.nft_name);
  const filesValidation = await validateFiles(id, request.files);
  const validated = nameValidation.validated && filesValidation.validated;
  const answer = validated
    ? "Post creation is started. Please wait a few minutes. We will notify the user you when it is done"
    : nameValidation.reason ?? filesValidation.reason ?? "Error creating post";

  return <AiData>{
    answer,
    needsPostProcessing: validated ? true : false,
    data: validated ? { id, request, language } : {},
  };
}

async function verify(
  id: string,
  request: any,
  language: string
): Promise<AiData> {
  console.log("verify", JSON.stringify(request, null, 2));
  const proofFilename = request.proofFilename;
  const filesValidation = await validateFiles(id, [proofFilename]);
  const validated = filesValidation.validated;
  const answer = validated
    ? "Verification is started. Please wait a few minutes. We will notify the user about the result of the verification when it is done"
    : filesValidation.reason ?? "Error verifying proof";

  return <AiData>{
    answer,
    needsPostProcessing: validated ? true : false,
    data: validated
      ? { id, proof: request.proofFilename, language, task: "verify" }
      : {},
  };
}

async function prove(
  id: string,
  request: any,
  language: string
): Promise<AiData> {
  console.log("prove", id, JSON.stringify(request, null, 2));
  const nameValidation = await validateName(id, request.nft_name);
  const keysValidation = await validateKeys(id, request.nft_name, request.keys);
  const validated =
    nameValidation.validated && keysValidation.validated && request.keys;
  const answer = validated
    ? "Proof generation is started. Please wait a few minutes. We will notify the user you when it is done"
    : nameValidation.reason ??
      keysValidation.reason ??
      "Error generating proof";

  const data = {
    id,
    username: request.nft_name,
    keys: request.keys,
    language,
    task: "prove",
  };

  return <AiData>{
    answer,
    needsPostProcessing: validated ? true : false,
    data: validated ? data : {},
  };
}

async function add_keys(
  id: string,
  request: any,
  language: string
): Promise<AiData> {
  console.log("add_keys", id, JSON.stringify(request, null, 2));
  const nameValidation = await validateName(id, request.nft_name);
  const keysValidation = await validateKeys(id, request.nft_name, request.keys);
  const validated =
    nameValidation.validated && keysValidation.validated && request.keys;
  const answer = validated
    ? "The addition of the key-value pairs have been started. Please wait a few minutes. We will notify the user you when it is done"
    : nameValidation.reason ??
      keysValidation.reason ??
      "Error adding key-value pairs";

  const data = {
    id,
    username: request.nft_name,
    keys: request.keys,
    language,
    task: "add",
  };

  return <AiData>{
    answer,
    needsPostProcessing: validated ? true : false,
    data: validated ? data : {},
  };
}

async function sell(id: string, request: any): Promise<AiData> {
  console.log("Function sell:", request);
  const nameValidation = await validateName(id, request.nft_name);
  const validated = nameValidation.validated;
  if (!validated)
    return <AiData>{
      answer: nameValidation.reason ?? "Error selling NFT",
      needsPostProcessing: false,
    };
  let answer: string = "Error selling NFT";
  const name = request.nft_name;
  if (
    request.price &&
    request.currency &&
    name &&
    name !== "" &&
    Number(request.price) &&
    currencies.includes(request.currency)
  ) {
    const names = new Names(NAMES_TABLE);
    await names.sell(name, Number(request.price), request.currency);
    await sleep(5000);
    const nft: NamesData | undefined = await names.get({ username: name });
    //console.log("sell function", nft);
    if (nft && nft.onSale == true) {
      await algoliaWriteToken(nft);
      answer = "NFT is on sale";
    } else console.error("Error: NFT sale", nft);
  }

  return <AiData>{
    answer,
    needsPostProcessing: false,
  };
}

async function listKeys(
  id: string,
  request: any,
  language: string
): Promise<AiData> {
  console.log("listKeys", id, JSON.stringify(request, null, 2));
  let answer = "Error listing keys";
  if (request.nft_name !== undefined && request.nft_name !== "") {
    const keys = await listPrivateKeys({
      id,
      username: request.nft_name,
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

async function aiTool(id: string, tool: any, language: string) {
  console.log("aiTool", id, tool, language);
  const request = JSON.parse(tool.arguments);
  const name = tool.name;
  switch (name) {
    case "edit":
      return await add_keys(id, request, language);
    case "create_post":
      return await create_post(id, request, language);
    case "sell":
      return await sell(id, request);
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
      return await listKeys(id, request, language);
    case "prove":
      return await prove(id, request, language);
    case "verify":
      return await verify(id, request, language);
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

async function addKeysPostProcess(data: any) {
  console.log("addKeysPostProcess", JSON.stringify(data, null, 2));
  await callLambda("keys", JSON.stringify(data));
  await sleep(1000);
  return;
}

async function provePostProcess(data: any) {
  console.log("provePostProcess", JSON.stringify(data, null, 2));
  await callLambda("keys", JSON.stringify(data));
  await sleep(1000);
  return;
}

async function verifyPostProcess(data: any) {
  console.log("verifyPostProcess", JSON.stringify(data, null, 2));
  await callLambda("keys", JSON.stringify(data));
  await sleep(1000);
  return;
}

async function create_nftPostProcess(data: any) {
  console.log("create_nftPostProcess", JSON.stringify(data, null, 2));
  const mintData: BotMintData = {
    id: data.id,
    language: data.language,
    timeNow: Date.now(),
    filename: data.request.nft_image,
    username: data.request.nft_name,
    creator: "@MinaNFT_bot",
    description: data.request.nft_description,
    keys: data.request.keys,
    files: data.request.files ?? [],
  };
  console.log(
    "create_nftPostProcess mintData",
    JSON.stringify(mintData, null, 2)
  );
  await startDeployment(mintData);
  await sleep(1000);
  return;
}

async function create_postPostProcess(data: any) {
  console.log("create_postPostProcess", JSON.stringify(data, null, 2));
  const mintData: BotMintData = {
    id: data.id,
    language: data.language,
    timeNow: Date.now(),
    filename: data.request.post_image,
    username: data.request.nft_name,
    postname: data.request.post_name,
    creator: "@MinaNFT_bot",
    description: data.request.post_description,
    keys: data.request.keys,
    files: data.request.files ?? [],
  };
  console.log(
    "create_postPostProcess mintData",
    JSON.stringify(mintData, null, 2)
  );
  await startDeployment(mintData);
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
        case "addKeys":
          await addKeysPostProcess(data);
          break;
        case "prove":
          await provePostProcess(data);
          break;
        case "verify":
          await verifyPostProcess(data);
          break;
        case "create_nft":
          await create_nftPostProcess(data);
          break;
        case "create_post":
          await create_postPostProcess(data);
          break;
        case "generate_image":
          await generate_imagePostProcess(data);
          break;
        default:
          console.error("aiPostProcess - wrong function name", functionName);
          break;
      }
    }
  }

  return;
}

async function validateFiles(
  id: string,
  filenames: string[]
): Promise<{ validated: boolean; reason?: string }> {
  if (filenames === undefined || filenames.length === 0)
    return { validated: true };
  const filesTable = new FilesTable(FILES_TABLE);
  const files: FileData[] = await filesTable.listFiles(id);
  if (files === undefined) {
    console.error("Error: files are not found", id, filenames);
    return { validated: false, reason: "Error: files are not found" };
  }
  for (const file of filenames) {
    const found = files.find((f) => f.filename === file);
    if (found === undefined) {
      console.error("Error: file is not found", id, file);
      return { validated: false, reason: `Error: file ${file} is not found` };
    }
  }
  return { validated: true };
}

async function validateKeys(
  id: string,
  nft_name: string,
  keys: string[]
): Promise<{ validated: boolean; reason?: string }> {
  if (keys === undefined || keys.length === 0) return { validated: true };
  if (nft_name === undefined || nft_name === "")
    return { validated: false, reason: "Error: nft_name is empty" };
  const keysData = await listPrivateKeys({
    id,
    username: nft_name,
  });
  if (keysData === undefined) {
    console.error("Error: keys are not found", id, nft_name, keys);
    return { validated: false, reason: "Error: keys are not found" };
  }
  for (const key of keys) {
    const found = keysData.find((k) => k.key === key);
    if (found === undefined) {
      console.error("Error: key is not found", id, nft_name, key);
      return {
        validated: false,
        reason: `Error: key ${key} is not found in NFT ${nft_name}`,
      };
    }
  }
  return { validated: true };
}

async function validateName(
  id: string,
  nft_name: string
): Promise<{ validated: boolean; reason?: string }> {
  if (nft_name === undefined || nft_name === "")
    return { validated: false, reason: "Error: nft_name is empty" };
  const names = new Names(NAMES_TABLE);
  const name: NamesData | undefined = await names.get({ username: nft_name });
  if (name === undefined) {
    console.error("Error: nft is not found", id, nft_name);
    return { validated: false, reason: `Error: NFT ${nft_name} is not found` };
  } else if (name.id !== id) {
    console.error("Error: nft is not owned by the user", id, nft_name);
    return {
      validated: false,
      reason: `Error: NFT ${nft_name}  is not owned by the user`,
    };
  } else if (
    name.ownerPrivateKey === undefined ||
    name.ownerPrivateKey === ""
  ) {
    console.error("Error: owner key is empty", id, nft_name);
    return {
      validated: false,
      reason: `Error: NFT ${nft_name} does not have owner key. The user should use minanft.io to manage it`,
    };
  }
  return { validated: true };
}

async function validateNewName(
  id: string,
  nft_name: string
): Promise<{ validated: boolean; reason?: string }> {
  if (nft_name === undefined || nft_name === "")
    return { validated: false, reason: "Error: nft_name is empty" };
  const names = new Names(NAMES_TABLE);
  const name: NamesData | undefined = await names.get({ username: nft_name });
  if (name !== undefined) {
    console.error("Error: nft already exists", id, nft_name);
    return {
      validated: false,
      reason: `Error: NFT ${nft_name} already exists`,
    };
  }
  return { validated: true };
}

/*
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
*/

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { getAIfunctions, aiTool, aiPostProcess };
