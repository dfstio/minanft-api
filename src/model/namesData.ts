import DeployData from "./deployData";

export default interface NamesData {
  username: string;
  description?: string;
  url?: string;
  id: string;
  signature?: string;
  publicKey?: string;
  language: string;
  timeCreated: number;
  deploy?: DeployData;
  ipfs?: string;
  uri?: any;

  onSale?: boolean;
  price?: number;
  currency?: string;
  creator?: string;
  testworld2?: any;
  testworld2uri?: any;
}
