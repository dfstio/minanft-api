import Table from "./table";
import MetadataData from "../model/metadata";
import { encryptJSON, decryptJSON } from "../nft/kms";

export default class MetadataTable extends Table<MetadataData> {
  public async createNewVersion(params: {
    username: string;
    version: number;
    uri: any;
    txId: string;
  }): Promise<void> {
    const { username, version, uri, txId } = params;
    const encrypted = await encryptJSON(uri, username);
    await this.create({
      username,
      version,
      metadata: encrypted,
      txId,
    } as MetadataData);
  }

  public async getURI(
    username: string,
    version: number
  ): Promise<any | undefined> {
    const data = await this.get({ username, version });
    if (data === undefined) return undefined;
    const decrypted = await decryptJSON(data.metadata, username);
    return decrypted;
  }
}
