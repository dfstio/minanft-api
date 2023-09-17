import AWS, { AWSError } from 'aws-sdk';
import { DocumentClient, GetItemOutput } from 'aws-sdk/clients/dynamodb';
import NamesData from '../model/namesData';
import DeployData from '../model/deployData';

export default class Names {
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

  public create(name: NamesData): void {
    const params = {
      TableName: this.tableName,
      Item: name,
    };
    console.log('create', params);
    this._client.put(params, (error) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async scan(): Promise<NamesData[]> {
    const params = {
      TableName: this.tableName,
      AttributesToGet: [
        'username',
        'id',
        'language',
        'timeCreated',
        'uri',
        'ipfs',
        'onSale',
        'price',
        'currency',
        'creator',
      ],
    };

    return this._client
      .scan(params)
      .promise()
      .then((res) => {
        console.log('scan', params, res);
        return res.Items as NamesData[];
      });
  }

  public async get(username: string): Promise<NamesData | undefined> {
    const params = {
      TableName: this.tableName,
      ConsistentRead: true,
      Key: {
        username: username,
      },
    };
    console.log('get Names', params);
    return this._client
      .get(params, (error: AWSError, data: GetItemOutput) => {
        if (error) {
          console.error(error);
          return undefined;
        }
        return data;
      })
      .promise()
      .then((res) => {
        if (res && res.Item) {
          console.log('get', params, res.Item);
          return res.Item as NamesData;
        } else {
          return undefined;
        }
      })
      .catch(() => {
        console.log('get DB query failed: no names data');
        return undefined;
      });
  }

  public async updateDeploy(username: string, data: DeployData): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        username: username,
      },
      UpdateExpression: 'set deploy = :data',
      ExpressionAttributeValues: { ':data': data },
      ReturnValues: 'UPDATED_NEW',
    };
    console.log('update', params);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async updateUri(
    username: string,
    ipfs: string,
    uri: any,
  ): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        username: username,
      },
      UpdateExpression: 'set ipfs = :ipfs, uri = :uri',
      ExpressionAttributeValues: { ':ipfs': ipfs, ':uri': uri },
      ReturnValues: 'UPDATED_NEW',
    };
    console.log('update', params);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async sell(
    username: string,
    price: number,
    currency: string,
  ): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        username: username,
      },
      UpdateExpression: 'set price = :p, currency = :c, onSale = :s',
      ExpressionAttributeValues: {
        ':p': price,
        ':c': currency.toLowerCase(),
        ':s': true,
      },
      ReturnValues: 'UPDATED_NEW',
    };
    console.log('update', params);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }
}
