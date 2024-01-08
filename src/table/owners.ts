import Table from "./table";
import { OwnersData } from "../model/ownersData";

export default class OwnersTable extends Table<OwnersData> {
  public async listNFTs(id: string): Promise<string[]> {
    const names: OwnersData[] = await this.queryData("id = :id", {
      ":id": id,
    });
    //console.log("listNFTs", names);
    const namesArray: string[] = [];
    if (names !== undefined && names.length !== 0)
      names.forEach((name) => {
        if (name.username) namesArray.push(name.username);
      });
    console.log("listNFTs", namesArray);
    return namesArray;
  }
}
