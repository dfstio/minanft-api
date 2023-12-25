import { Handler, Context } from "aws-lambda";
import { deployContract, checkBalance, createNFT } from "./src/mina/account";
import { deployNFT } from "./src/mina/deploy";
import { apiMintNFT } from "./src/api/mint";
import { mint_v3 as mint_v3_func } from "./src/api/mint_v3";
import { startDeploymentIpfs } from "./src/nft/nft";
import { initLanguages, getLanguage } from "./src/lang/lang";

import AccountData from "./src/model/accountData";

const deploy: Handler = async (event: any, context: Context) => {
  try {
    console.log("deploy", event);
    await initLanguages();
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

const deploynft: Handler = async (event: any, context: Context) => {
  try {
    console.log("deploy nft", event);
    await initLanguages();
    await deployNFT(event.id, event);

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

const mint_v2: Handler = async (event: any, context: Context) => {
  try {
    console.log("mint_v2", event);
    await initLanguages();
    await apiMintNFT(event.id, event.uri, event.privateKey, event.language);

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

const mint_v3: Handler = async (event: any, context: Context) => {
  try {
    console.log("mint_v3", event);
    await initLanguages();
    await mint_v3_func(
      event.id,
      event.jobId,
      event.uri,
      event.signature,
      event.privateKey,
      event.useArweave,
      event.language
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

const topup: Handler = async (event: any, context: Context) => {
  try {
    console.log("topup", event);
    if (event.id && event.data && event.data.account && event.data.gastank)
      await checkBalance(
        event.id,
        <AccountData>event.data.account,
        event.data.gastank
      );
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
    if (event.id && event.data) {
      await initLanguages();
      await createNFT(event.id, event.data);
    } else console.error("no event.id or event.data");

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

const deployipfs: Handler = async (event: any, context: Context) => {
  try {
    console.log("deploymentIpfs", event);
    if (event.id && event.command) {
      await initLanguages();
      //const language = await getLanguage(event.id);
      await startDeploymentIpfs(
        event.id,
        event.language,
        event.command,
        event.creator ? event.creator : ""
      );
    } else console.error("no event.id or event.command");

    //context.succeed(event.id);
    return {
      statusCode: 200,
      body: event.id,
    };
  } catch (error) {
    console.error("catch", (<any>error).toString());
    return {
      statusCode: 200,
      body: "deploymentIpfs error",
    };
  }
};

export { deploy, deploynft, topup, create, deployipfs, mint_v2, mint_v3 };
