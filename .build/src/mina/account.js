"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNFT = exports.checkBalance = exports.deployContract = void 0;
const o1js_1 = require("o1js");
const axios_1 = __importDefault(require("axios"));
const message_1 = __importDefault(require("./message"));
const tasks_1 = __importDefault(require("../table/tasks"));
const names_1 = __importDefault(require("../table/names"));
const avatarnft_1 = require("./avatarnft");
const ipfs_1 = __importDefault(require("../storage/ipfs"));
const gastanks_1 = require("./gastanks");
const algolia_1 = require("../nft/algolia");
const conversions_1 = require("./conversions");
const MINAURL = process.env.MINAURL
    ? process.env.MINAURL
    : 'https://proxy.berkeley.minaexplorer.com/graphql';
const MINAEXPLORER = process.env.MINAEXPLORER
    ? process.env.MINAEXPLORER
    : 'https://berkeley.minaexplorer.com/wallet/';
const PRIVATEKEY = process.env.PRIVATEKEY;
const FEE = 0.1e9;
const GASTANK_MINLIMIT = 5;
const TASKS_TABLE = process.env.TASKS_TABLE;
const NAMES_TABLE = process.env.NAMES_TABLE;
const PINATA_JWT = process.env.PINATA_JWT;
async function generateAccount(id, gastank = '') {
    console.log('generateAccount', id);
    const zkAppPrivateKey = o1js_1.PrivateKey.random();
    const zkAppPrivateKeyString = o1js_1.PrivateKey.toBase58(zkAppPrivateKey);
    const zkAppAddress = zkAppPrivateKey.toPublicKey();
    const zkAppAddressString = o1js_1.PublicKey.toBase58(zkAppAddress);
    const salt = o1js_1.Field.random();
    let result = {
        privateKey: zkAppPrivateKeyString,
        publicKey: zkAppAddressString,
        explorer: `${MINAEXPLORER}${zkAppAddressString}`,
        salt: salt.toJSON(),
    };
    console.log('Created account', result);
    await topupAccount(result.publicKey);
    const table = new tasks_1.default(TASKS_TABLE);
    const MIN_IN_MS = 60 * 1000;
    const task = {
        id,
        task: 'topup',
        startTime: Date.now() + MIN_IN_MS,
        taskdata: { account: result, gastank },
    };
    await table.create(task);
}
async function checkBalance(id, data, gastank) {
    console.log('Checking balance...', id, data);
    if (!data || !gastank || gastank == '') {
        console.error('Wrong topup data');
        return;
    }
    await minaInit();
    const accountPrivateKeyMina = o1js_1.PrivateKey.fromBase58(data.privateKey);
    const accountPublicKeyMina = accountPrivateKeyMina.toPublicKey();
    const gasTankPrivateKeyMina = o1js_1.PrivateKey.fromBase58(gastank);
    const gasTankPublicKeyMina = gasTankPrivateKeyMina.toPublicKey();
    const balanceAccount = await accountBalance(accountPublicKeyMina);
    const balanceAccountMina = Number(balanceAccount.toBigInt()) / 1e9;
    console.log('Balance of account', balanceAccountMina.toLocaleString('en'));
    if (balanceAccount.toBigInt() > Number(FEE)) {
        console.log('Creating tx...');
        const fee = o1js_1.UInt64.from(FEE);
        const amount = balanceAccount.sub(fee);
        const tx = await o1js_1.Mina.transaction({ sender: accountPublicKeyMina, fee }, () => {
            let senderUpdate = o1js_1.AccountUpdate.create(accountPublicKeyMina);
            senderUpdate.requireSignature();
            senderUpdate.send({ to: gasTankPublicKeyMina, amount });
        });
        tx.sign([accountPrivateKeyMina]);
        let sentTx = await tx.send();
        const table = new tasks_1.default(TASKS_TABLE);
        await table.remove('topup');
        if (sentTx.hash() !== undefined) {
            console.log(`
Success! Topup transaction sent:
https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
	`);
        }
        else
            console.error('Send topup fail', sentTx);
    }
}
exports.checkBalance = checkBalance;
async function checkGasTank(gastank) {
    const gasTankPrivateKeyMina = o1js_1.PrivateKey.fromBase58(gastank);
    const gasTankPublicKeyMina = gasTankPrivateKeyMina.toPublicKey();
    const balanceGasTank = await accountBalance(gasTankPublicKeyMina);
    const balanceGasTankMina = Number(balanceGasTank.toBigInt()) / 1e9;
    const replenishGasTank = balanceGasTankMina < GASTANK_MINLIMIT;
    console.log('Balance of gas tank', o1js_1.PublicKey.toBase58(gasTankPublicKeyMina), 'is', balanceGasTankMina.toLocaleString('en'), ', needs replenishing:', replenishGasTank);
    return replenishGasTank;
}
var deployer1;
var deployer2;
var deployer3;
async function getDeployer() {
    let i = Math.floor(Math.random() * (gastanks_1.GASTANKS.length - 1));
    let replenish = await checkGasTank(gastanks_1.GASTANKS[i]);
    while (i === deployer1 || i === deployer2 || i === deployer3 || replenish) {
        console.log(`Deployer ${i} was recently used or empty, finding another`);
        i = Math.floor(Math.random() * (gastanks_1.GASTANKS.length - 1));
        replenish = await checkGasTank(gastanks_1.GASTANKS[i]);
    }
    deployer3 = deployer2;
    deployer2 = deployer1;
    deployer1 = i;
    const gastank = gastanks_1.GASTANKS[i];
    console.log(`Using gas tank no ${i} with private key ${gastank}, last deployers:`, deployer1, deployer2, deployer3);
    const deployerPrivateKey = o1js_1.PrivateKey.fromBase58(gastank);
    return deployerPrivateKey;
}
async function deployContract(id, nft) {
    console.log('deployContract', id);
    try {
        const names = new names_1.default(NAMES_TABLE);
        const name = await names.get(nft.username);
        if (name) {
            console.log('Found old deployment', name);
            return;
        }
        console.log('name', name);
        const bot = new message_1.default(id, nft.language);
        if (nft.ipfs === '') {
            axios_1.default
                .get(`https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/${nft.uri.image}`, {
                responseType: 'arraybuffer',
            })
                .then((response) => {
                console.log('cloudinary ping - aws');
            })
                .catch((e) => console.error('cloudinary ping - aws', e));
        }
        await minaInit();
        const zkAppPrivateKey = o1js_1.PrivateKey.random();
        const zkAppPrivateKeyString = o1js_1.PrivateKey.toBase58(zkAppPrivateKey);
        const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
        const zkAppAddressString = o1js_1.PublicKey.toBase58(zkAppPublicKey);
        const secret = o1js_1.Field.random();
        await bot.tmessage('createdNFTaccount', { account: zkAppAddressString });
        let result = {
            privateKey: zkAppPrivateKeyString,
            publicKey: zkAppAddressString,
            explorer: `${MINAEXPLORER}${zkAppAddressString}`,
            telegramId: id,
            secret: o1js_1.Field.toJSON(secret),
        };
        console.log('NFT deployment (1/3): created NFT account', result);
        let cidImage;
        if (!nft.ipfs || nft.ipfs === '') {
            const ipfs = new ipfs_1.default(PINATA_JWT);
            cidImage = await ipfs.addLink(nft.uri.image);
            if (cidImage)
                cidImage = 'https://ipfs.io/ipfs/' + cidImage;
        }
        else
            cidImage = nft.uri.image;
        console.log('cidImage', cidImage);
        if (!cidImage || cidImage === '') {
            console.error('deployContract - addLink error');
            await bot.tmessage('IPFSerrorimage');
            return;
        }
        let deployedNFT = nft;
        deployedNFT.deploy = result;
        deployedNFT.uri.image = cidImage;
        deployedNFT.uri.minaPublicKey = zkAppAddressString;
        deployedNFT.uri.minaExplorer = `${MINAEXPLORER}${zkAppAddressString}`;
        let cidURI;
        if (!nft.ipfs || nft.ipfs === '') {
            const ipfs = new ipfs_1.default(PINATA_JWT);
            cidURI = await ipfs.add(deployedNFT.uri);
        }
        else
            cidURI = nft.ipfs;
        console.log('cidURI', cidURI);
        if (!cidURI) {
            console.error('deployContract - add error');
            await bot.tmessage('IPFSerroruri');
            return;
        }
        deployedNFT.ipfs = cidURI;
        console.log('Writing deployment to Names');
        await names.create(deployedNFT);
        const deployerPrivateKey = await getDeployer();
        const deployerPublicKey = deployerPrivateKey.toPublicKey();
        let zkApp = new avatarnft_1.AvatarNFT(zkAppPublicKey);
        const startTime = Date.now();
        console.log('Compiling NFT smart contract...');
        let { verificationKey } = await avatarnft_1.AvatarNFT.compile();
        const compileTime = Date.now();
        const delay = formatWinstonTime(compileTime - startTime);
        console.log('Compilation took', delay);
        const hash = await deploy(deployerPrivateKey, zkAppPrivateKey, zkApp, verificationKey, bot);
        if (!hash || hash == '') {
            console.error('Error deploying contract');
            await bot.tmessage('Errordeployingcontract');
            return;
        }
        const table = new tasks_1.default(TASKS_TABLE);
        const MIN_IN_MS = 60 * 1000;
        const task = {
            id,
            task: 'create',
            startTime: Date.now() + MIN_IN_MS,
            taskdata: deployedNFT,
        };
        await table.update(task);
        await sleep(1000);
    }
    catch (err) {
        console.error(err);
    }
}
exports.deployContract = deployContract;
async function createNFT(id, nft) {
    console.log('createNFT', id, nft);
    const bot = new message_1.default(id, nft.language);
    if (!nft.deploy || !nft.ipfs || !nft.deploy.secret) {
        console.error('No nft.deploy or nft.ipfs or deploy.secret');
        await bot.tmessage('ErrordeployingNFT');
        return;
    }
    axios_1.default
        .get(`https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${nft.uri.image}`, {
        responseType: 'arraybuffer',
    })
        .then((response) => {
        console.log('cloudinary ping');
    })
        .catch((e) => console.error('cloudinary ping', e));
    await minaInit();
    const address = o1js_1.PublicKey.fromBase58(nft.deploy.publicKey);
    let check = await o1js_1.Mina.hasAccount(address);
    console.log('check1', check);
    if (!check) {
        await (0, o1js_1.fetchAccount)({ publicKey: address });
        check = await o1js_1.Mina.hasAccount(address);
        console.log('check2', check);
        if (!check)
            return;
    }
    let zkApp = new avatarnft_1.AvatarNFT(o1js_1.PublicKey.fromBase58(nft.deploy.publicKey));
    const startTime = Date.now();
    console.log('Compiling smart contract...');
    let { verificationKey } = await avatarnft_1.AvatarNFT.compile();
    const compileTime = Date.now();
    const delay = formatWinstonTime(compileTime - startTime);
    console.log('Compilation took', delay);
    console.log('Creating tx...');
    const deployerPrivateKey = await getDeployer();
    const deployerPublicKey = deployerPrivateKey.toPublicKey();
    await (0, o1js_1.fetchAccount)({ publicKey: deployerPublicKey });
    let sender = deployerPrivateKey.toPublicKey();
    const ipfsFields = (0, conversions_1.ipfsToFields)('ipfs:' + nft.ipfs);
    if (!ipfsFields) {
        console.error('Error converting IPFS hash');
        await bot.tmessage('ErrorconvertingIPFShash');
        return;
    }
    let newsecret;
    if (nft.deploy && nft.deploy.secret)
        newsecret = o1js_1.Field.fromJSON(nft.deploy.secret);
    else {
        console.error('No secret in nft.deploy.secret');
        await bot.tmessage('Cannotsetnewpasssword');
        return;
    }
    const map = new o1js_1.MerkleMap();
    const root = map.getRoot();
    const tx = await o1js_1.Mina.transaction({
        sender,
        fee: 0.1e9,
        memo: '@minanft_bot',
    }, () => {
        zkApp.createNFT(o1js_1.Encoding.stringToFields(nft.username)[0], root, root, root, root, ipfsFields[0], ipfsFields[1], o1js_1.Field.fromJSON(process.env.NFT_SALT), o1js_1.Field.fromJSON(process.env.NFT_SECRET));
    });
    const startTime1 = Date.now();
    await tx.prove();
    const endTime = Date.now();
    const delay3 = formatWinstonTime(endTime - startTime1);
    console.log('Proof took', delay3, ', now sending transaction...');
    tx.sign([deployerPrivateKey]);
    let sentTx = await tx.send();
    if (sentTx.hash() !== undefined) {
        await (0, algolia_1.algoliaWriteToken)(nft);
        const successMsg = `Success! NFT deployment (3/3): NFT ${nft.uri.name} is written to MINA blockchain: 
https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}

You can see it at https://minanft.io/${nft.username}
If you want to create one more NFT, type command "new"`;
        console.log(successMsg);
        const table = new tasks_1.default(TASKS_TABLE);
        await table.remove(id);
        await sleep(1000);
        await bot.tmessage('sucessDeploymentMessage', { nftname: nft.username, hash: sentTx.hash() });
    }
    else {
        console.error('Send fail', sentTx);
        await bot.tmessage('Transactionhasfailed');
    }
    await sleep(1000);
    return;
}
exports.createNFT = createNFT;
async function topupAccount(publicKey) {
    o1js_1.Mina.faucet(o1js_1.PublicKey.fromBase58(publicKey));
}
async function accountBalance(address) {
    let check = await o1js_1.Mina.hasAccount(address);
    console.log('check1', check);
    if (!check) {
        await (0, o1js_1.fetchAccount)({ publicKey: address });
        check = await o1js_1.Mina.hasAccount(address);
        console.log('check2', check);
        if (!check)
            return o1js_1.UInt64.from(0);
    }
    const balance = await o1js_1.Mina.getBalance(address);
    return balance;
}
async function minaInit() {
    console.log('Initialising MINA from', MINAURL);
    const Network = o1js_1.Mina.Network(MINAURL);
    await o1js_1.Mina.setActiveInstance(Network);
    console.log('o1js loaded');
}
const deployTransactionFee = 100000000;
async function deploy(deployerPrivateKey, zkAppPrivateKey, zkapp, verificationKey, bot) {
    let sender = deployerPrivateKey.toPublicKey();
    let zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log('using deployer private key with public key', sender.toBase58());
    console.log('using zkApp private key with public key', zkAppPublicKey.toBase58());
    console.log('Deploying zkapp for public key', zkAppPublicKey.toBase58());
    let transaction = await o1js_1.Mina.transaction({ sender, fee: deployTransactionFee, memo: '@minanft_bot' }, () => {
        o1js_1.AccountUpdate.fundNewAccount(sender);
        zkapp.deploy({ verificationKey });
    });
    await transaction.prove();
    transaction.sign([deployerPrivateKey, zkAppPrivateKey]);
    console.log('Sending the deploy transaction...');
    const res = await transaction.send();
    const hash = res.hash();
    if (hash === undefined) {
        console.log('error sending deploy transaction');
    }
    else {
        console.log('NFT deployment (2/3): smart contract deployed: ', 'https://berkeley.minaexplorer.com/transaction/' + hash);
        await bot.tmessage('smartcontractdeployed', { hash: hash });
    }
    return hash;
}
function formatWinstonTime(ms) {
    if (ms === undefined)
        return '';
    if (ms < 1000)
        return ms.toString() + ' ms';
    if (ms < 60 * 1000)
        return parseInt((ms / 1000).toString()).toString() + ' sec';
    if (ms < 60 * 60 * 1000)
        return parseInt((ms / 1000 / 60).toString()).toString() + ' min';
    return parseInt((ms / 1000 / 60 / 60).toString()).toString() + ' h';
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=account.js.map