"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const o1js_1 = require("o1js");
const node_crypto_1 = require("node:crypto");
class Merkle {
    constructor(salt) {
        this.map = new o1js_1.MerkleMap();
        this.salt = salt;
    }
    addString(name, value) {
        this.map.set(this.toHash(name), this.toHash(value));
    }
    addNumber(name, value) {
        this.map.set(this.toHash(name), this.numberHash(value));
    }
    addPublicKey(name, value) {
        const fields = value.toFields();
        let i;
        for (i = 0; i < fields.length; i++)
            this.map.set(this.toHash(name + i.toString()), o1js_1.Poseidon.hash([this.salt, fields[i]]));
    }
    root() {
        return this.map.getRoot();
    }
    numberHash(value) {
        return o1js_1.Poseidon.hash([this.salt, (0, o1js_1.Field)(value)]);
    }
    toHash(str) {
        const sha256 = (0, node_crypto_1.createHash)("sha256");
        sha256.update(str);
        const data = (0, o1js_1.Field)(sha256.digest().readBigUInt64BE());
        const hash = o1js_1.Poseidon.hash([this.salt, data]);
        console.log(`${str} hash: ${hash.toString()}`);
        return hash;
    }
}
exports.default = Merkle;
//# sourceMappingURL=merkle.js.map