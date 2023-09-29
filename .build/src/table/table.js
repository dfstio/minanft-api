"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
class Table {
    constructor(tableName) {
        const options = {};
        this._client = new client_dynamodb_1.DynamoDBClient(options);
        this.tableName = tableName;
        console.log("Table", tableName, "region", process.env.AWS_REGION);
    }
    get client() {
        return this._client;
    }
    async create(item) {
        try {
            const params = {
                TableName: this.tableName,
                Item: (0, util_dynamodb_1.marshall)(item),
            };
            console.log("Table: create", params);
            const command = new client_dynamodb_1.PutItemCommand(params);
            const data = await this._client.send(command);
            console.log("Success: Table: create", data);
        }
        catch (error) {
            console.error("Error: Table: create", error);
        }
    }
    async scan() {
        try {
            const params = {
                TableName: this.tableName,
                ConsistentRead: true,
            };
            console.log("Table: scan", params);
            const command = new client_dynamodb_1.ScanCommand(params);
            const data = await this._client.send(command);
            let result = [];
            if (data.Items === undefined)
                return result;
            for (let i = 0; i < data.Items.length; i++) {
                result.push((0, util_dynamodb_1.unmarshall)(data.Items[i]));
            }
            console.log("Success: Table: scan", result);
            return result;
        }
        catch (error) {
            console.error("Error: Table: scan", error);
            return [];
        }
    }
    async get(key) {
        try {
            const params = {
                TableName: this.tableName,
                Key: (0, util_dynamodb_1.marshall)(key),
                ConsistentRead: true,
            };
            console.log("Table: get", params);
            const command = new client_dynamodb_1.GetItemCommand(params);
            const data = await this._client.send(command);
            if (data.Item === undefined)
                return undefined;
            return (0, util_dynamodb_1.unmarshall)(data.Item);
        }
        catch (error) {
            console.error("Error: Table: get", error);
            return undefined;
        }
    }
    async update(item) {
        await this.create(item);
    }
    async remove(key) {
        try {
            const params = {
                TableName: this.tableName,
                Key: (0, util_dynamodb_1.marshall)(key)
            };
            console.log("Table: remove", params);
            const command = new client_dynamodb_1.DeleteItemCommand(params);
            const data = await this._client.send(command);
        }
        catch (error) {
            console.error("Error: Table: remove", error);
        }
    }
    async updateData(key, names, values, updateExpression) {
        try {
            const params = {
                TableName: this.tableName,
                Key: (0, util_dynamodb_1.marshall)(key),
                ExpressionAttributeNames: names,
                ExpressionAttributeValues: (0, util_dynamodb_1.marshall)(values),
                UpdateExpression: updateExpression,
                ReturnValues: 'UPDATED_NEW',
            };
            console.log("Table: updateData", params);
            const command = new client_dynamodb_1.UpdateItemCommand(params);
            const data = await this._client.send(command);
        }
        catch (error) {
            console.error("Error: Table: updateData", error);
        }
    }
    async queryData(keyConditionExpression, expressionAttributeValues) {
        try {
            const params = {
                TableName: this.tableName,
                ConsistentRead: true,
                KeyConditionExpression: keyConditionExpression,
                ExpressionAttributeValues: (0, util_dynamodb_1.marshall)(expressionAttributeValues),
            };
            console.log("Table: queryData", params);
            const command = new client_dynamodb_1.QueryCommand(params);
            const data = await this._client.send(command);
            let result = [];
            if (data.Items === undefined)
                return result;
            for (let i = 0; i < data.Items.length; i++) {
                result.push((0, util_dynamodb_1.unmarshall)(data.Items[i]));
            }
            console.log("Success: Table: queryData", result);
            return result;
        }
        catch (error) {
            console.error("Error: Table: queryData", error);
            return [];
        }
    }
}
exports.default = Table;
//# sourceMappingURL=table.js.map