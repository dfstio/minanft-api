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
        const message = {
            role: isUser
                ? ChatCompletionRequestMessageRoleEnum.User
                : ChatCompletionRequestMessageRoleEnum.Assistant,
            content: msg,
        };
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

    public async query(id: string): Promise<HistoryData[]> {
        const params = {
            TableName: this.tableName,
            KeyConditionExpression: "id = :id",
            ExpressionAttributeValues: { ":id": id },
        };

        return this._client
            .query(params)
            .promise()
            .then((res) => {
                //console.log("scan", params, res);
                return res.Items as HistoryData[];
            });
    }

    public async remove(id: string, time: number): Promise<void> {
        const params = {
            TableName: this.tableName,
            Key: {
                id: id,
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

    public async get(id: string): Promise<ChatCompletionRequestMessage[]> {
        let history: HistoryData[] = await this.query(id);
        let messages: ChatCompletionRequestMessage[] = [];
        const count = history.length;
        history.sort((a, b) => b.time - a.time);
        console.log(history);
        let i: number = count - 1;
        let size: number = 0;
        const timeLimit: number = Date.now() - HISTORY_HOURS * 60 * 60 * 1000;
        let msgSize: number = (history[i].message.content || "").length;
        while (
            i > 0 &&
            history[i].time > timeLimit &&
            size + msgSize < HISTORY_CHARS
        ) {
            size += msgSize;
            i--;
            msgSize = (history[i].message.content || "").length;
        }
        let k: number;
        for (k = 0; k < i; k++) {
            await this.remove(id, history[k].time);
        }
        for (k = i; k < count; k++) {
            messages.push(history[k].message);
        }
        return messages;
    }
}
