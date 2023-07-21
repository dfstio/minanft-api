import DeployData from "./deployData";

export default interface NamesData {
  username: string;
  id: string;
  timeCreated: number;
  deploy?: DeployData;
  ipfs?: string;
  uri?: any;
}
