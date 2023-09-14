import DeployData from "./deployData";

export default interface NamesData {
  username: string;
  description?: string;
  url?: string;
  id: string;
  language: string;
  timeCreated: number;
  deploy?: DeployData;
  ipfs?: string;
  uri?: any;

  onSale?: boolean;
  price?: number;
  currency?: string;
  creator?: string;
}
