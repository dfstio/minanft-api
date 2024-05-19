import Table from "./table";
import { NamesData } from "../model/namesData";
import { MINANFT_NAME_SERVICE } from "minanft";

export default class Names extends Table<NamesData> {
  public async getReservedName(params: {
    username: string;
  }): Promise<NamesData | undefined> {
    const name = await this.get({ username: params.username });
    if (name === undefined) return undefined;
    if (name.chain === undefined) name.chain = "devnet";
    if (name.contract === undefined) name.contract = MINANFT_NAME_SERVICE;
    return name;
  }

  public async updateStorage(
    username: string,
    storage: string,
    uri: any
  ): Promise<void> {
    await this.updateData(
      { username: username },
      { "#S": "storage", "#U": "uri" },
      { ":storage": storage, ":uri": uri },
      "set #S = :storage, #U = :uri"
    );
  }

  public async sell(
    username: string,
    price: number,
    currency: string
  ): Promise<void> {
    await this.updateData(
      { username: username },
      { "#P": "price", "#C": "currency", "#S": "onSale" },
      {
        ":p": price,
        ":c": currency.toLowerCase(),
        ":s": true,
      },
      "set #P = :p, #C = :c, #S = :s"
    );
  }
}
