"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nftPrice = void 0;
const vipnames_1 = require("../nft/vipnames");
function nftPrice(username) {
    let category = 3;
    if (username.length <= 5)
        category = 2;
    if (username.length <= 3)
        category = 1;
    if (vipnames_1.vipnames.includes(username))
        category = 0;
    let price = {
        username: username,
        price: prices[category].price,
        currency: "usd",
        description: prices[category].description,
    };
    return price;
}
exports.nftPrice = nftPrice;
const prices = [
    {
        price: 999,
        description: "Exclusive Avatar NFT name",
    },
    {
        price: 99,
        description: "Short Avatar NFT Name",
    },
    {
        price: 49,
        description: "Short Avatar NFT name",
    },
    {
        price: 19,
        description: "Avatar NFT name",
    },
];
//# sourceMappingURL=pricing.js.map