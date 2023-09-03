import AWS from "aws-sdk";

export default async function callLambda(name: string, payload: any) {
  console.log("Lambda call", name, payload);
  const lambda = new AWS.Lambda();

  const params = {
    FunctionName: "minanft-telegram-bot-dev-" + name, // the lambda function we are going to invoke
    InvocationType: "Event", //''RequestResponse',
    Payload: payload,
  };

  await lambda.invoke(params, function (err, data) {
    if (err) {
      console.error("Lambda error: ", err);
    } else {
      console.log("Lambda result ", data);
    }
  });

  //TODO: Switch to AWS SDK 3.0 and use await
  await sleep(1000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
