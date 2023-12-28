export interface NamesData {
  username: string;
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
  //testworld2?: any;
  //testworld2uri?: any;
}

export interface BotMintData {
  id: string;
  language: string;
  timeNow: number;
  filename: string;
  username: string;
  creator: string;
}
