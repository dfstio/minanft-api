"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_lambda_1 = require("@aws-sdk/client-lambda");
async function callLambda(name, payload) {
    try {
        console.log("Lambda call", name, payload);
        const client = new client_lambda_1.LambdaClient();
        const params = {
            FunctionName: "minanft-telegram-bot-dev-" + name,
            InvocationType: "Event",
            Payload: payload,
        };
        const command = new client_lambda_1.InvokeCommand(params);
        await client.send(command);
        await sleep(1000);
    }
    catch (error) {
        console.error("Error: Lambda call", error);
    }
}
exports.default = callLambda;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=lambda.js.map