"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.botapi = void 0;
const nft_1 = require("./src/nft/nft");
const BOTAPIAUTH = process.env.BOTAPIAUTH;
const botapi = async (event, context, callback) => {
    try {
        console.log("event", event.body);
        const body = JSON.parse(event.body);
        if (body &&
            body.auth &&
            body.auth === BOTAPIAUTH &&
            body.command &&
            body.data) {
            switch (body.command) {
                case "mint":
                    await (0, nft_1.startDeploymentApi)(body.data);
                    break;
                default:
                    console.error("Wrong command");
            }
        }
        callback(null, {
            statusCode: 200,
            body: "ok",
        });
    }
    catch (error) {
        console.error("bot api catch", error.toString());
        callback(null, {
            statusCode: 200,
            body: error.toString(),
        });
    }
};
exports.botapi = botapi;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=api.js.map