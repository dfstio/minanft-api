import { Handler, Context } from "aws-lambda";
import {
  //deployNFT,
  addKeys,
  proveKeys,
  verifyKeys,
  deployPost,
} from "./src/mina/deploy";
import {
  mint_v3 as mint_v3_func,
  post_v3 as post_v3_func,
} from "./src/api/mint_v3";
import { initLanguages, getLanguage } from "./src/lang/lang";
import { deployNFTV4 } from "./src/mina/deploy-v4";

const deploynft: Handler = async (event: any, context: Context) => {
  try {
    console.log("deploy nft", event);
    await initLanguages();
    if (event.postname && event.postname.length > 0) await deployPost(event);
    else await deployNFTV4(event);

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

const keys: Handler = async (event: any, context: Context) => {
  try {
    console.log("keys", event);
    await initLanguages();
    switch (event.task) {
      case "add":
        await addKeys(event);
        break;
      case "prove":
        await proveKeys(event);
        break;
      case "verify":
        await verifyKeys(event);
        break;
      default:
        console.error("unknown task");
    }

    //context.succeed(event.id);
    return {
      statusCode: 200,
      body: event.id,
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "mina.addkeys error",
    };
  }
};

const mint_v3: Handler = async (event: any, context: Context) => {
  try {
    console.log("mint_v3", event);
    const language = await getLanguage(event.id);
    await initLanguages();
    await mint_v3_func(
      event.id,
      event.jobId,
      event.uri,
      event.signature,
      event.privateKey,
      event.useArweave,
      language
    );

    //context.succeed(event.id);
    return {
      statusCode: 200,
      body: event.id,
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "mina.mint_v2 error",
    };
  }
};

const post_v3: Handler = async (event: any, context: Context) => {
  try {
    console.log("post_v3", event);
    const language = await getLanguage(event.id);
    await initLanguages();
    await post_v3_func(
      event.id,
      event.jobId,
      event.transactions,
      event.args,
      language
    );

    //context.succeed(event.id);
    return {
      statusCode: 200,
      body: event.id,
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "mina.mint_v2 error",
    };
  }
};
export { deploynft, keys, mint_v3, post_v3 };
