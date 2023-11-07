"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFilename = exports.startDeploymentApi = exports.startDeploymentIpfs = exports.startDeployment = void 0;
const lambda_1 = __importDefault(require("../lambda/lambda"));
const message_1 = __importDefault(require("../mina/message"));
const lang_1 = require("../lang/lang");
const axios_1 = __importDefault(require("axios"));
const jwt_1 = require("../api/jwt");
async function startDeployment(id, language, timeNow, filename, username, creator) {
    console.log('startDeployment', id, language, username, timeNow, filename);
    const bot = new message_1.default(id, language);
    let uri = {
        name: username[0] == '@' ? username : '@' + username,
        description: '',
        url: '',
        type: 'object',
        image: filename,
        external_url: 'minanft.io',
        time: timeNow,
    };
    let nft = {
        username: username,
        id: id,
        timeCreated: timeNow,
        uri: uri,
        creator: creator == '' ? '@MinaNFT_bot' : '@' + creator,
        language: language,
    };
    await bot.image(`https://minanft-storage.s3.eu-west-1.amazonaws.com/${filename}`, { caption: uri.name });
    await bot.invoice(uri.name, `https://minanft-storage.s3.eu-west-1.amazonaws.com/${filename}`);
    await (0, lambda_1.default)('deploy', JSON.stringify(nft));
}
exports.startDeployment = startDeployment;
async function startDeploymentIpfs(id, language, command, creator) {
    console.log('startDeploymentIpfs', id, language, command, creator);
    const bot = new message_1.default(id, language);
    try {
        const response = await axios_1.default.get(`https://ipfs.io/ipfs/${command}`);
        console.log('startDeploymentIpfs axios', response.data);
        const uri = response.data;
        console.log('uri', uri);
        if (uri.name && uri.image) {
            let nft = {
                username: uri.name[0] == '@' ? uri.name : '@' + uri.name,
                id: id,
                timeCreated: Date.now(),
                uri: uri,
                creator: creator == '' ? '@MinaNFT_bot' : '@' + creator,
                language: language,
                ipfs: command,
            };
            await bot.image(`https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${uri.image}`, { caption: uri.name });
            await bot.invoice(uri.name, `${uri.image}`);
            await (0, lambda_1.default)('deploy', JSON.stringify(nft));
        }
        else
            console.error('startDeploymentIpfs - wrong uri', uri);
    }
    catch (error) {
        console.error('startDeploymentIpfs', error, error.data, error.response.data);
    }
}
exports.startDeploymentIpfs = startDeploymentIpfs;
async function startDeploymentApi(body) {
    console.log('startDeploymentApi', body);
    const { jwtToken, ipfs } = body;
    const id = (0, jwt_1.verifyJWT)(jwtToken);
    if (id) {
        console.log('startDeploymentApi', id, ipfs);
        const language = await (0, lang_1.getLanguage)(id);
        await (0, lambda_1.default)('deployipfs', JSON.stringify({
            id,
            command: ipfs,
            creator: '',
            language
        }));
    }
}
exports.startDeploymentApi = startDeploymentApi;
function generateFilename(timeNow) {
    let outString = '';
    let inOptions = 'abcdefghijklmnopqrstuvwxyz0123456789_';
    for (let i = 0; i < 30; i++) {
        outString += inOptions.charAt(Math.floor(Math.random() * inOptions.length));
    }
    return timeNow.toString() + '-' + outString;
}
exports.generateFilename = generateFilename;
//# sourceMappingURL=nft.js.map