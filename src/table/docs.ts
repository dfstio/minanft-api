import Table from "./table";
import { DocsData, DocsSummaryData } from "../model/docsData";

export default class Docs extends Table<DocsData> { }

/*
import AWS, { AWSError } from "aws-sdk";
import { DocumentClient, GetItemOutput } from "aws-sdk/clients/dynamodb";
import { DocsData, DocsSummaryData } from "../model/docsData";

export default class Docs {
  private _client: DocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    let options = {};
    this._client = new AWS.DynamoDB.DocumentClient(options);
    this.tableName = tableName;
  }

  get client(): DocumentClient {
    return this.client;
  }

  public create(doc: DocsData): void {
    const params = {
      TableName: this.tableName,
      Item: doc,
    };
    console.log("create doc", params);
    this._client.put(params, (error) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async summary(): Promise<DocsSummaryData[]> {
    const params = {
      TableName: this.tableName,
      AttributesToGet: ["id", "name", "summary"],
    };

    return this._client
      .scan(params)
      .promise()
      .then((res) => {
        //console.log("scan", params, res);
        return res.Items as DocsSummaryData[];
      });
  }

  public async get(id: string): Promise<DocsData> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
    };

    return this._client
      .get(params, (error: AWSError, data: GetItemOutput) => {
        if (error) {
          console.error(error);
          return;
        }
        return data;
      })
      .promise()
      .then((res) => {
        console.log("get", params, res.Item);
        return res.Item as DocsData;
      });
  }
}
*/