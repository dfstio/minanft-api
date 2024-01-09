import Table from "./table";
import UserData from "../model/userData";
import AccountData from "../model/accountData";
import AIUsage from "../model/aiusage";
import Questions from "../questions";

export default class Users extends Table<UserData> {
  private formQuestions: Questions;

  constructor(tableName: string) {
    super(tableName);
    this.formQuestions = new Questions();
  }

  public async getItem(id: string): Promise<UserData | undefined> {
    return await this.get({ id: id });
  }

  public async getAccount(id: string): Promise<AccountData | undefined> {
    const data: UserData | undefined = await this.get({ id: id });
    if (data === undefined) return undefined;
    return data.account;
  }

  /*
  public async getDeployment(id: string): Promise<DeployData | undefined> {
    const data: UserData | undefined = await this.get({ id: id })
    if (data === undefined) return undefined;
    return data.deployment;
  }
  */

  public async getCurrentLanguage(id: string): Promise<string> {
    const data: UserData | undefined = await this.get({ id: id });
    if (data === undefined) return "en";
    return data.language_code;
  }

  public async getVoice(id: string): Promise<boolean> {
    const data: UserData | undefined = await this.get({ id: id });
    if (data === undefined) return false;
    return data.voice === true ? true : false;
  }

  public async setVoice(id: string, voice: boolean): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#V": "voice",
      },
      { ":voice": voice },
      `set #V = :voice`
    );
  }

  private getExpAttrValue(
    shortName: string,
    answer: string,
    num: number
  ): object {
    return JSON.parse(`{":ans" : ${num},"${shortName}" : "${answer}"}`);
  }

  public async updateAnswer(
    id: string,
    currAnswer: number,
    val: string
  ): Promise<void> {
    const currFormQuestion = this.formQuestions.getCurrentQuestion(currAnswer);
    if (currFormQuestion && currFormQuestion.shortName) {
      const nextNum = currAnswer + 1;
      await this.updateData(
        { id: id },
        {
          "#A": "currentAnswer",
          "#Q": currFormQuestion.name,
        },
        this.getExpAttrValue(currFormQuestion.shortName, val, nextNum),
        `set #A = :ans, #Q = ${currFormQuestion.shortName}`
      );
    }
  }

  public async resetAnswer(id: string): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#A": "currentAnswer",
        "#U": "username",
      },
      {
        ":ans": 0,
        ":usr": "",
      },
      `set #A = :ans, #U = :usr`
    );
  }

  public async updateAccount(id: string, account: AccountData): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#A": "account",
      },
      { ":acc": account },
      `set #A = :acc`
    );
  }

  public async updateUsage(id: string, usage: AIUsage): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#P": "prompt_tokens",
        "#C": "completion_tokens",
        "#T": "total_tokens",
      },
      {
        ":p": usage.prompt_tokens,
        ":c": usage.completion_tokens,
        ":t": usage.total_tokens,
      },
      `ADD #P :p, #C :c, #T :t`
    );
  }

  public async updateImageUsage(id: string): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#I": "images_created",
      },
      { ":i": 1 },
      `ADD #I :i`
    );
  }

  /*
  public async updateDeployment(
    id: string,
    account: DeployData
  ): Promise<void> {
    await this.updateData(
      { id: id },
      {
        "#D": "deployment",
      },
      { ":dp": account },
      `set #D = :dp`
    );
  }
*/
  public async increaseCounter(id: string, currAnswer: number): Promise<void> {
    const nextNum = currAnswer + 1;
    await this.updateData(
      { id: id },
      {
        "#A": "currentAnswer",
      },
      { ":ans": nextNum },
      `set #A = :ans`
    );
  }
}

/*
import AWS, { AWSError } from "aws-sdk";
import { DocumentClient, GetItemOutput } from "aws-sdk/clients/dynamodb";
import FormAnswer from "../model/formAnswer";
import AccountData from "../model/accountData";
import DeployData from "../model/deployData";
import AIUsage from "../model/aiusage";
import Questions from "../questions";

export default class Users {
  private _client: DocumentClient;
  private tableName: string;
  private formQuestions: Questions;

  constructor(tableName: string) {
    let options = {};
    this._client = new AWS.DynamoDB.DocumentClient(options);
    this.tableName = tableName;
    this.formQuestions = new Questions();
  }

  get client(): DocumentClient {
    return this.client;
  }

  public async createForm(
    id: string,
    username: string,
    message_id: string,
    user: any,
    language_code: string,
  ): Promise<void> {
    const emptyForm: FormAnswer = {
      id,
      username: "",
      minanft: [],
      message: "",
      currentAnswer: 0,
      message_id: "",
      language_code: "en",
      chatGPTinit: false,
    };
    const params = {
      TableName: this.tableName,
      Item: {
        id,
        username,
        minanft: [],
        message_id,
        message: "",
        currentAnswer: emptyForm.currentAnswer,
        user,
        language_code,
        chatGPTinit: emptyForm.chatGPTinit,
      },
    };
    this._client.put(params, (error) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }
  public async getItem(id: string): Promise<FormAnswer> {
    const params = {
      TableName: this.tableName,
      ConsistentRead: true,
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
        return data.Item;
      })
      .promise()
      .then((res) => {
        return res.Item as FormAnswer;
      });
  }

  public async getFullItem(id: string) {
    const params = {
      TableName: this.tableName,
      ConsistentRead: true,
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
        return data.Item;
      })
      .promise()
      .then((res) => {
        return res.Item;
      });
  }

  public async getCurrentState(id: string): Promise<FormAnswer> {
    const params = {
      TableName: this.tableName,
      ConsistentRead: true,
      Key: {
        id: id,
      },
    };
    const emptyForm: FormAnswer = {
      id,
      minanft: [],
      currentAnswer: 0,
      message_id: "",
      message: "",
      language_code: "en",
      chatGPTinit: false,
    };

    return this._client
      .get(params, (error: AWSError, data: GetItemOutput) => {
        if (error) {
          console.error(error);
          return emptyForm;
        }
        return data.Item;
      })
      .promise()
      .then((res) => {
        if (res) {
          return res.Item as FormAnswer;
        } else {
          return emptyForm;
        }
      })
      .catch(() => {
        console.error("DB query failed: return currAnswer=0");
        return emptyForm;
      });
  }

  public async getAccount(id: string): Promise<AccountData | undefined> {
    const params = {
      TableName: this.tableName,
      ConsistentRead: true,
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
        return data.Item;
      })
      .promise()
      .then((res) => {
        if (res && res.Item && res.Item.account) {
          return res.Item.account;
        } else {
          return undefined;
        }
      })
      .catch(() => {
        console.error("getAccount DB query failed: no account data");
        return undefined;
      });
  }

  public async getDeployment(id: string): Promise<DeployData | undefined> {
    const params = {
      TableName: this.tableName,
      ConsistentRead: true,
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
        return data.Item;
      })
      .promise()
      .then((res) => {
        if (res && res.Item && res.Item.deployment) {
          return res.Item.deployment;
        } else {
          return undefined;
        }
      })
      .catch(() => {
        console.log("getDeployment DB query failed: no account data");
        return undefined;
      });
  }

  public async getCurrentLanguage(id: string): Promise<string> {
    const params = {
      TableName: this.tableName,
      ConsistentRead: true,
      Key: {
        id: id,
      },
    };
    return this._client
      .get(params, (error: AWSError, data: GetItemOutput) => {
        if (error) {
          console.error(error);
          return "en";
        }
        return data.Item;
      })
      .promise()
      .then((res) => {
        if (res) {
          return (res.Item as FormAnswer).language_code;
        } else {
          return "en";
        }
      })
      .catch(() => {
        console.log("DB query failed: return language_code=en");
        return "en";
      });
  }

  public async updateAnswer(
    id: string,
    currAnswer: number,
    val: string,
  ): Promise<void> {
    const currFormQuestion = this.formQuestions.getCurrentQuestion(currAnswer);
    if (currFormQuestion && currFormQuestion.shortName) {
      const nextNum = currAnswer + 1;
      const params = {
        TableName: this.tableName,
        Key: {
          id: id,
        },
        UpdateExpression: `set currentAnswer = :ans, ${currFormQuestion.name} = ${currFormQuestion.shortName}`,
        ExpressionAttributeValues: this.getExpAttrValue(
          currFormQuestion.shortName,
          val,
          nextNum,
        ),
        ReturnValues: "UPDATED_NEW",
      };
      console.log("updateAnswer", params);
      this._client.update(params, (error, data) => {
        if (error) {
          console.error(error);
          return;
        }
      });
    }
  }

  public async resetAnswer(id: string): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
      UpdateExpression: `set currentAnswer = :ans, username = :usr`,
      ExpressionAttributeValues: {
        ":ans": 0,
        ":usr": "",
      },
      ReturnValues: "UPDATED_NEW",
    };

    console.log("resetAnswer", params);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async updateMessageId(
    id: string,
    message_id: string,
    message: string = "",
  ): Promise<void> {
    const msg: string = message ? message : "";
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
      UpdateExpression: `set message_id = :msgId, message = :message`,
      ExpressionAttributeValues: {
        ":msgId": message_id,
        ":message": msg,
      },
      ReturnValues: "UPDATED_NEW",
    };
    console.log("updateMessageId", params);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  public async updateAccount(id: string, account: AccountData): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
      UpdateExpression: `set account = :acc`,
      ExpressionAttributeValues: { ":acc": account },
      ReturnValues: "UPDATED_NEW",
    };
    console.log("updateAccount", params);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error("updateAccount error", error);
        return;
      } else console.log("updateAccount data", data);
    });
  }

  public async updateUsage(id: string, usage: AIUsage): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
      UpdateExpression: `ADD prompt_tokens :p, completion_tokens :c, total_tokens :t`,
      ExpressionAttributeValues: {
        ":p": usage.prompt_tokens,
        ":c": usage.completion_tokens,
        ":t": usage.total_tokens,
      },
      ReturnValues: "UPDATED_NEW",
    };
    console.log("updateUsage", params, usage);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error("updateUsage error", error);
        return;
      } else console.log("updateUsage data", data);
    });
  }

  public async updateImageUsage(id: string): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
      UpdateExpression: `ADD images_created :i`,
      ExpressionAttributeValues: { ":i": 1 },
      ReturnValues: "UPDATED_NEW",
    };
    console.log("updateImageUsage", params);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error("updateImageUsage error", error);
        return;
      } else console.log("updateImageUsage data", data);
    });
  }

  public async updateDeployment(
    id: string,
    account: DeployData,
  ): Promise<void> {
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
      UpdateExpression: `set deployment = :dp`,
      ExpressionAttributeValues: { ":dp": account },
      ReturnValues: "UPDATED_NEW",
    };
    console.log("updateDeployment", params);
    this._client.update(params, (error, data) => {
      if (error) {
        console.error("updateDeployment error", error);
        return;
      } else console.log("updateDeployment data", data);
    });
  }

  public async increaseCounter(id: string, currAnswer: number): Promise<void> {
    const nextNum = currAnswer + 1;
    const params = {
      TableName: this.tableName,
      Key: {
        id: id,
      },
      UpdateExpression: `set currentAnswer = :ans`,
      ExpressionAttributeValues: {
        ":ans": nextNum,
      },
      ReturnValues: "UPDATED_NEW",
    };
    this._client.update(params, (error, data) => {
      if (error) {
        console.error(error);
        return;
      }
    });
  }

  private getExpAttrValue(
    shortName: string,
    answer: string,
    num: number,
  ): object {
    return JSON.parse(`{":ans" : ${num},"${shortName}" : "${answer}"}`);
  }
}
*/
