import { blockchain } from "minanft";

export default interface MetadataData {
  username: string;
  version: number;
  metadata: string;
  txId: string;
  chain: blockchain;
  contractAddress: string;
}
