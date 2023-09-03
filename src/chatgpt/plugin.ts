import { Configuration, OpenAIApi } from "openai";
import merkleData from "../connector/merkledata";
/*

	ChatGPT plugin code (preliminary)
	Documentation: https://platform.openai.com/docs/plugins/introduction
*/

//TODO: Rewrite plugin functionality after getting access to ChatGPT 4.0 plugins
export default class ChatGPTPlugin {
  api: OpenAIApi;

  constructor(token: string) {
    const configuration = new Configuration({
      //organization: "YOUR_ORG_ID",
      apiKey: token,
    });
    this.api = new OpenAIApi(configuration);
  }

  public async activate(event: any): Promise<string> {
    if (!event) return "Wrong request event";
    const id: string = event.id ? event.id : "";
    if (id !== "") {
      const answer = await merkleData(id);
      return JSON.stringify({ telegramId: id, result: answer });
    } else return "Wrong request";
  }
}
