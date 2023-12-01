import callLambda from "../lambda/lambda";
import BotMessage from "../mina/message";
import { initLanguages, getLanguage } from "../lang/lang";
import axios from "axios";
import { verifyJWT } from "../api/jwt";
import { sleep } from "minanft";

async function startDeployment(
  id: string,
  language: string,
  timeNow: number,
  filename: string,
  username: string,
  creator: string
): Promise<void> {
  console.log("startDeployment", id, language, username, timeNow, filename);
  const bot = new BotMessage(id, language);

  let uri = {
    name: username[0] == "@" ? username : "@" + username,
    description: "",
    url: "",
    type: "object",
    image: filename,
    external_url: "minanft.io",
    time: timeNow,
  };

  let nft = {
    username: username,
    id: id,
    timeCreated: timeNow,
    uri: uri,
    creator: creator == "" ? "@MinaNFT_bot" : "@" + creator,
    language: language,
  };

  await callLambda("deploynft", JSON.stringify(nft));
  await sleep(1000);
}

/*
async function startDeploymentOld(
  id: string,
  language: string,
  timeNow: number,
  filename: string,
  username: string,
  creator: string
): Promise<void> {
  console.log("startDeployment", id, language, username, timeNow, filename);
  const bot = new BotMessage(id, language);

  let uri = {
    name: username[0] == "@" ? username : "@" + username,
    description: "",
    url: "",
    type: "object",
    image: filename,
    external_url: "minanft.io",
    time: timeNow,
  };

  let nft = {
    username: username,
    id: id,
    timeCreated: timeNow,
    uri: uri,
    creator: creator == "" ? "@MinaNFT_bot" : "@" + creator,
    language: language,
  };
  const image = `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/${filename}`;
  await bot.image(image, {
    caption: uri.name[0] === "@" ? uri.name.slice(1) : uri.name,
  });
  await bot.invoice(uri.name[0] === "@" ? uri.name.slice(1) : uri.name, image);
  await callLambda("deploy", JSON.stringify(nft));
}
*/

async function startDeploymentIpfs(
  id: string,
  language: string,
  command: string,
  creator: string
): Promise<void> {
  console.log("startDeploymentIpfs", id, language, command, creator);
  const bot = new BotMessage(id, language);

  try {
    const response: any = await axios.get(`https://ipfs.io/ipfs/${command}`);
    console.log("startDeploymentIpfs axios", response.data);
    const uri = response.data;
    console.log("uri", uri);

    if (uri.name && uri.image) {
      let nft = {
        username: uri.name[0] == "@" ? uri.name : "@" + uri.name,
        id: id,
        timeCreated: Date.now(),
        uri: uri,
        creator: creator == "" ? "@MinaNFT_bot" : "@" + creator,
        language: language,
        ipfs: command,
      };
      await callLambda("deploynft", JSON.stringify(nft));
    } else console.error("startDeploymentIpfs - wrong uri", uri);
  } catch (error: any) {
    console.error(
      "startDeploymentIpfs",
      error,
      error.data,
      error.response.data
    );
  }
}

async function startDeploymentApi(id: string, ipfs: string): Promise<void> {
  console.log("startDeploymentApi", id, ipfs);

  const language = await getLanguage(id);
  await callLambda(
    "deployipfs",
    JSON.stringify({
      id,
      command: ipfs,
      creator: "",
      language,
    })
  );
}

async function mint_v2(
  id: string,
  uri: string,
  privateKey: string | undefined
): Promise<void> {
  console.log("mint_v2", id, uri, privateKey);

  const language = await getLanguage(id);
  await callLambda(
    "mint_v2",
    JSON.stringify({
      id,
      uri,
      privateKey: privateKey ?? "",
      language,
    })
  );
}

function generateFilename(timeNow: number): string {
  let outString: string = "";
  let inOptions: string = "abcdefghijklmnopqrstuvwxyz0123456789_";

  for (let i = 0; i < 30; i++) {
    outString += inOptions.charAt(Math.floor(Math.random() * inOptions.length));
  }
  return timeNow.toString() + "-" + outString;
}

export {
  startDeployment,
  startDeploymentIpfs,
  startDeploymentApi,
  mint_v2,
  generateFilename,
};
