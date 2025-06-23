import type { Handler, Context, Callback } from "aws-lambda";
import { PublicKey, Poseidon, Mina, AccountUpdate, PrivateKey } from "o1js";
import { getDeployer } from "./src/mina/deployers";
import { MinaNFT, sleep, fetchMinaAccount, initBlockchain } from "minanft";
import { minaInit } from "./src/mina/init";
import { GASTANKS } from "./src/mina/gastanks";
import { rateLimit, initializeRateLimiter } from "./src/api/rate-limit";

initializeRateLimiter({
  name: "hash",
  points: 180,
  duration: 60,
});

const FAUCET_AMOUNT = 50_000_000_000n;
const MINIMUM_BALANCE = 70;

const calculate: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  const ip = event?.requestContext?.identity?.sourceIp ?? "no-ip";
  if (
    await rateLimit({
      name: "hash",
      key: ip,
    })
  ) {
    console.log("rate limit", ip);
    callback(null, {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: "error: rate limit exceeded",
    });
    return;
  }
  try {
    console.time("hash");
    //console.log("event", event);
    const body = JSON.parse(event.body);
    console.log("hash started", ip, body);
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
      let deployer: PrivateKey | undefined;
      let amount = FAUCET_AMOUNT;
      if (body.chain === "zeko") {
        await initBlockchain("zeko");
        deployer = PrivateKey.fromBase58(
          GASTANKS[Math.floor(Math.random() * (GASTANKS.length - 1))]
        );
        //amount = 1_000_000_000_000n;
      } else {
        await minaInit();
        deployer = await getDeployer(MINIMUM_BALANCE);
      }

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
            reason: "Grahql endpoint error",
          }),
        });
        return;
      }
      const sender = deployer.toPublicKey();
      await fetchMinaAccount({ publicKey: sender });
      await fetchMinaAccount({ publicKey });
      const hasAccount = Mina.hasAccount(publicKey);
      const hasFunds = Mina.hasAccount(sender);
      if (!hasFunds) {
        callback(null, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: JSON.stringify({
            hash: "",
            isCalculated: false,
            reason: "Grahql endpoint error",
          }),
        });
      }

      const transaction = await Mina.transaction(
        { sender, fee: 200_000_000, memo: "minanft.io faucet" },
        async () => {
          const senderUpdate = AccountUpdate.createSigned(sender);
          if (!hasAccount)
            senderUpdate.balance.subInPlace(
              body.chain === "zeko" ? 100_000_000n : 1_000_000_000n
            );
          senderUpdate.send({ to: publicKey, amount });
        }
      );
      transaction.sign([deployer]);
      const tx = await transaction.safeSend();
      console.log("tx", tx);
      const hash = tx.hash;
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
