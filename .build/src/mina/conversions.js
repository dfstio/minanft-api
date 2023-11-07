"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fieldsToIPFS = exports.ipfsToFields = void 0;
const o1js_1 = require("o1js");
function ipfsToFields(ipfs) {
    try {
        const fields = o1js_1.Encoding.stringToFields(ipfs);
        if (fields.length !== 2)
            console.error("ipfsToFields error, length is", fields.length, ipfs, fields);
        console.log("ipfsToFields length", fields.length, ipfs);
        return fields;
    }
    catch (error) {
        console.error("ipfsToFields error", error);
        return undefined;
    }
}
exports.ipfsToFields = ipfsToFields;
function fieldsToIPFS(fields) {
    try {
        if (fields.length !== 2)
            console.error("fieldsToIPFS error, length is", fields.length);
        return o1js_1.Encoding.stringFromFields(fields);
    }
    catch (error) {
        console.error("fieldsToIPFS error", error);
        return undefined;
    }
}
exports.fieldsToIPFS = fieldsToIPFS;
//# sourceMappingURL=conversions.js.map