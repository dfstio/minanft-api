"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyInvoice = exports.supportInvoice = exports.postInvoice = exports.mintInvoice = void 0;
const pricing_1 = require("./pricing");
function mintInvoice(id, T, username, image) {
    const price = (0, pricing_1.nftPrice)(username);
    const invoice = {
        provider_token: process.env.STRIPE_KEY,
        title: "Mina NFT " + username,
        description: T("ReservationNFTname"),
        currency: "usd",
        photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${image}`,
        prices: [
            { label: price.description, amount: price.price * 100 },
            { label: T("NFTtokendeployment"), amount: 9 * 100 },
        ],
        payload: JSON.stringify({ username, id }),
    };
    console.log("Invoice", invoice);
    return invoice;
}
exports.mintInvoice = mintInvoice;
function buyInvoice(token, T) {
    const invoice = {
        provider_token: process.env.STRIPE_KEY,
        title: "Mina NFT " + token.name,
        description: T("PurchaseofAvatarNFT"),
        currency: token.currency.toLowerCase(),
        photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/${token.image}`,
        prices: [{ label: "Mina NFT " + token.name, amount: token.price * 100 }],
        payload: JSON.stringify({ name: token.name }),
    };
    console.log("Invoice", invoice);
    return invoice;
}
exports.buyInvoice = buyInvoice;
function postInvoice(id, T, postId, username, image) {
    const invoice = {
        provider_token: process.env.STRIPE_KEY,
        title: "Mina NFT post " + username,
        description: T("DeploymentofMinaNFTpost"),
        currency: "usd",
        photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/${image}`,
        prices: [{ label: T("NFTpostdeployment"), amount: 5 * 100 }],
        payload: JSON.stringify({ username, id, postId }),
    };
    console.log("Invoice post", invoice);
    return invoice;
}
exports.postInvoice = postInvoice;
function supportInvoice(id, T) {
    const invoice = {
        provider_token: process.env.STRIPE_KEY,
        title: T("MinaNFT1hoursupport"),
        description: T("SupportbyMinaNFTteam"),
        currency: "usd",
        photo_url: `https://res.cloudinary.com/minanft/image/fetch/h_300,q_100,f_auto/https://minanft-storage.s3.eu-west-1.amazonaws.com/minanft_profile_photo.jpg`,
        prices: [{ label: T("Support1hour"), amount: 100 * 100 }],
        payload: JSON.stringify({ id }),
    };
    console.log("Invoice support", invoice);
    return invoice;
}
exports.supportInvoice = supportInvoice;
//# sourceMappingURL=stripe.js.map