import { PrivateKey, PublicKey } from "o1js";
import { accountBalanceMina } from "minanft";
import { GASTANKS } from "./gastanks";
const GASTANK_MINLIMIT = 3;

var deployer1: number | undefined;
var deployer2: number | undefined;
var deployer3: number | undefined;

//TODO stop relying on AWS saving state in short term and replace with DynamoDB table logic
export async function getDeployer(): Promise<PrivateKey> {
  let i: number = Math.floor(Math.random() * (GASTANKS.length - 1));
  let replenish: boolean = await checkGasTank(GASTANKS[i]);
  while (i === deployer1 || i === deployer2 || i === deployer3 || replenish) {
    console.log(`Deployer ${i} was recently used or empty, finding another`);
    i = Math.floor(Math.random() * (GASTANKS.length - 1));
    replenish = await checkGasTank(GASTANKS[i]);
  }
  // shifting last deployers
  deployer3 = deployer2;
  deployer2 = deployer1;
  deployer1 = i;

  const gastank = GASTANKS[i];
  console.log(
    `Using gas tank no ${i} with private key ${gastank}, last deployers:`,
    deployer1,
    deployer2,
    deployer3
  );
  const deployerPrivateKey = PrivateKey.fromBase58(gastank);
  return deployerPrivateKey;
}

async function checkGasTank(gastank: string): Promise<boolean> {
  const gasTankPrivateKeyMina = PrivateKey.fromBase58(gastank);
  const gasTankPublicKeyMina = gasTankPrivateKeyMina.toPublicKey();

  const balanceGasTank = await accountBalanceMina(gasTankPublicKeyMina);
  const replenishGasTank: boolean = balanceGasTank < GASTANK_MINLIMIT;
  console.log(
    "Balance of gas tank",
    PublicKey.toBase58(gasTankPublicKeyMina),
    "is",
    balanceGasTank.toLocaleString("en"),
    ", needs replenishing:",
    replenishGasTank
  );

  return replenishGasTank;
  /*
    if (replenishGasTank) {
        const table = new Tasks(TASKS_TABLE);
        const topupTask = await table.get("topup");
        if (topupTask) {
            console.log("Already started topup");
            return;
        }
      
        //await generateAccount("topup", gastank);
        return true;
    } else return false;
    */
}
