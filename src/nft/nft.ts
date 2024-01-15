import callLambda from "../lambda/lambda";
import { sleep } from "minanft";
import { BotMintData } from "../model/namesData";

async function startDeployment(params: BotMintData): Promise<void> {
  console.log("startDeployment", params);

  await callLambda("deploynft", JSON.stringify(params));
  await sleep(1000);
}

function generateFilename(timeNow: number): string {
  let outString: string = "";
  let inOptions: string = "abcdefghijklmnopqrstuvwxyz0123456789_";

  for (let i = 0; i < 30; i++) {
    outString += inOptions.charAt(Math.floor(Math.random() * inOptions.length));
  }
  return timeNow.toString() + "-" + outString;
}

function getFormattedDateTime(time: number): string {
  const now = new Date(time);

  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");

  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");

  return `${year}.${month}.${day}-${hours}.${minutes}.${seconds}`;
}

export { startDeployment, generateFilename, getFormattedDateTime };
