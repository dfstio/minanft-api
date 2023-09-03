import AWS, { AWSError } from "aws-sdk";
import { DocumentClient, GetItemOutput } from "aws-sdk/clients/dynamodb";
import HistoryData from "../model/historyData";
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
} from "openai";
const HISTORY_HOURS: number = Number(process.env.HISTORY_HOURS!);
const HISTORY_CHARS: number = Number(process.env.HISTORY_CHARS!);

export default class History {
  private _client: DocumentClient;
  private tableName: string;
  private id: string;

  constructor(tableName: string, id: string) {
    let options = {};
    this._client = new AWS.DynamoDB.DocumentClient(options);
    this.tableName = tableName;
    this.id = id;
  }

  get client(): DocumentClient {
    return this.client;
  }

  public async add(msg: string, isUser: boolean = false): Promise<void> {
    const message: ChatCompletionRequestMessage = <
      ChatCompletionRequestMessage
    >{
      role: isUser
        ? ChatCompletionRequestMessageRoleEnum.User
        : ChatCompletionRequestMessageRoleEnum.Assistant,
      content: msg,
    };
    await this.addAnswer(message);
  }

  public async addAnswer(message: ChatCompletionRequestMessage): Promise<void> {
    const params = {
      TableName: this.tableName,
      Item: { id: this.id, time: Date.now(), message },
    };
    console.log("History - add msg", params);
    this._client.put(params, (error) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async query(): Promise<HistoryData[]> {
    const params = {
      TableName: this.tableName,
      ConsistentRead: true,
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: { ":id": this.id },
    };

    return this._client
      .query(params)
      .promise()
      .then((res) => {
        //console.log("scan", params, res);
        return res.Items as HistoryData[];
      });
  }

  public async remove(time: number): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: this.id,
        time: time,
      },
    };
    console.log("remove", params);
    this._client.delete(params, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async build(
    context: ChatCompletionRequestMessage[],
    request: ChatCompletionRequestMessage[],
  ): Promise<ChatCompletionRequestMessage[]> {
    let history: HistoryData[] = await this.query();
    let messages: ChatCompletionRequestMessage[] = [];
    let size: number = 0;
    for (const msg of context) {
      const msgSize: number = (msg.content || "").length;
      size += msgSize;
      messages.push(msg);
    }
    for (const msg of request) {
      const msgSize: number = (msg.content || "").length;
      size += msgSize;
    }

    const count = history.length;
    history.sort((a, b) => b.time - a.time);
    console.log("history: ", history);

    const timeLimit: number = Date.now() - HISTORY_HOURS * 60 * 60 * 1000;
    let subset: HistoryData[] = [];
    for (const item of history) {
      const msgSize: number = (item.message.content || "").length;
      if (item.time > timeLimit && size + msgSize < HISTORY_CHARS) {
        size += msgSize;
        subset.push(item);
      } else await this.remove(item.time);
    }

    subset.sort((a, b) => a.time - b.time);
    for (const item of subset) {
      messages.push(item.message);
    }
    for (const msg of request) {
      messages.push(msg);
    }
    return messages;
  }
}
