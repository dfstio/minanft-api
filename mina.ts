import { Handler, Context } from "aws-lambda";
import { deployContract, checkBalance, createNFT } from "./src/mina/account";
import AccountData from "./src/model/accountData";

const deploy: Handler = async (event: any, context: Context) => {
  try {
    console.log("deploy", event);
    await deployContract(event.id, event);

    //context.succeed(event.id);
    return {
      statusCode: 200,
      body: event.id,
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "mina.deploy error",
    };
  }
};

const topup: Handler = async (event: any, context: Context) => {
  try {
    console.log("topup", event);
    if (event.id && event.data)
      await checkBalance(event.id, <AccountData>event.data);
    else console.error("no event.id");

    //context.succeed(event.id);
    return {
      statusCode: 200,
      body: event.id,
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "mina.topup error",
    };
  }
};

const create: Handler = async (event: any, context: Context) => {
  try {
    console.log("create", event);
    if (event.id && event.data) await createNFT(event.id, event.data);
    else console.error("no event.id or event.data");

    //context.succeed(event.id);
    return {
      statusCode: 200,
      body: event.id,
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "mina.create error",
    };
  }
};

export { deploy, topup, create };
