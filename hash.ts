import type { Handler, Context, Callback } from "aws-lambda";
import { PublicKey, Poseidon, fetchAccount, Mina, AccountUpdate } from "o1js";
import { getDeployer } from "./src/mina/deployers";
import { MinaNFT, sleep } from "minanft";
import { minaInit } from "./src/mina/init";

const FAUCET_AMOUNT = 10_000_000_000n;
const MINIMUM_BALANCE = 12;

const calculate: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("hash");
    //console.log("event", event);
    const body = JSON.parse(event.body);
    console.log("hash started", body);
    if (
      body.auth === undefined ||
      body.auth !== process.env.BOTAPIAUTH! ||
      body.publicKey === undefined ||
      body.publicKey === ""
    ) {
      console.error("Wrong call format");
      callback(null, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          hash: "",
          isCalculated: false,
          reason: "Wrong call format",
        }),
      });
      return;
    }

    const publicKey = PublicKey.fromBase58(body.publicKey);
    console.log("publicKey", publicKey.toBase58());
    if (body.faucet === "true") {
      minaInit();
      const deployer = await getDeployer(MINIMUM_BALANCE);
      if (deployer === undefined) {
        console.error("Faucet: No deployer available");
        callback(null, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: JSON.stringify({
            hash: "",
            isCalculated: false,
            reason: "Faucet is empty",
          }),
        });
        return;
      }
      const sender = deployer.toPublicKey();
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey });
      const hasAccount = Mina.hasAccount(publicKey);

      const transaction = await Mina.transaction(
        { sender, fee: "100000000", memo: "faucet" },
        () => {
          if (!hasAccount) AccountUpdate.fundNewAccount(sender);
          const senderUpdate = AccountUpdate.create(sender);
          senderUpdate.requireSignature();
          senderUpdate.send({ to: publicKey, amount: FAUCET_AMOUNT });
        }
      );
      await transaction.prove();
      transaction.sign([deployer]);
      const tx = await transaction.send();
      await MinaNFT.transactionInfo(tx, "faucet", false);
      const hash = tx.hash();
      console.log("tx hash", hash);
      await sleep(1000);
      console.timeEnd("hash");
      callback(null, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({ hash: hash ?? "", isCalculated: true }),
      });
      return;
    } else {
      const hash = Poseidon.hash(publicKey.toFields());
      console.log("hash", hash.toJSON());
      console.timeEnd("hash");
      callback(null, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({ hash: hash.toJSON(), isCalculated: true }),
      });
    }
  } catch (error) {
    console.error("catch", (error as any).toString());
    callback(null, {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        hash: "",
        isCalculated: false,
        reason: (error as any).toString(),
      }),
    });
  }
};

export { calculate };
