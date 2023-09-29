"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployipfs = exports.create = exports.topup = exports.deploy = void 0;
const account_1 = require("./src/mina/account");
const nft_1 = require("./src/nft/nft");
const lang_1 = require("./src/lang/lang");
const deploy = async (event, context) => {
    try {
        console.log("deploy", event);
        await (0, lang_1.initLanguages)();
        await (0, account_1.deployContract)(event.id, event);
        return {
            statusCode: 200,
            body: event.id,
        };
    }
    catch (error) {
        console.error("catch", error.toString());
        return {
            statusCode: 200,
            body: "mina.deploy error",
        };
    }
};
exports.deploy = deploy;
const topup = async (event, context) => {
    try {
        console.log("topup", event);
        if (event.id && event.data && event.data.account && event.data.gastank)
            await (0, account_1.checkBalance)(event.id, event.data.account, event.data.gastank);
        else
            console.error("no event.id");
        return {
            statusCode: 200,
            body: event.id,
        };
    }
    catch (error) {
        console.error("catch", error.toString());
        return {
            statusCode: 200,
            body: "mina.topup error",
        };
    }
};
exports.topup = topup;
const create = async (event, context) => {
    try {
        console.log("create", event);
        if (event.id && event.data) {
            await (0, lang_1.initLanguages)();
            await (0, account_1.createNFT)(event.id, event.data);
        }
        else
            console.error("no event.id or event.data");
        return {
            statusCode: 200,
            body: event.id,
        };
    }
    catch (error) {
        console.error("catch", error.toString());
        return {
            statusCode: 200,
            body: "mina.create error",
        };
    }
};
exports.create = create;
const deployipfs = async (event, context) => {
    try {
        console.log("deploymentIpfs", event);
        if (event.id && event.command) {
            await (0, lang_1.initLanguages)();
            await (0, nft_1.startDeploymentIpfs)(event.id, event.language, event.command, event.creator ? event.creator : "");
        }
        else
            console.error("no event.id or event.command");
        return {
            statusCode: 200,
            body: event.id,
        };
    }
    catch (error) {
        console.error("catch", error.toString());
        return {
            statusCode: 200,
            body: "deploymentIpfs error",
        };
    }
};
exports.deployipfs = deployipfs;
//# sourceMappingURL=mina.js.map