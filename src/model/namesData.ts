export interface NamesData {
  username: string;
  chain: string;
  contract: string;
  //description?: string;
  //url?: string;
  id: string;
  signature?: string;
  privateKey?: string;
  publicKey?: string;
  ownerPrivateKey?: string;
  language: string;
  timeCreated: number;
  storage?: string;
  uri?: any;

  onSale?: boolean;
  price?: number;
  currency?: string;
  creator?: string;

  version?: string;
  developer?: string;
  repo?: string;
}

export interface KeyData {
  key: string;
  value: string;
  isPrivate: boolean;
}

export interface BotMintData {
  id: string;
  language: string;
  timeNow: number;
  filename: string;
  username: string;
  chain: string;
  postname?: string;
  creator: string;
  description?: string;
  keys: KeyData[];
  files: string[];
}

/*
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


*/
