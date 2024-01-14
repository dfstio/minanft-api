import type { Handler, Context, Callback } from "aws-lambda";
import { PublicKey, Poseidon } from "o1js";

const calculate: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  try {
    console.time("hash");
    console.log("event", event);
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
