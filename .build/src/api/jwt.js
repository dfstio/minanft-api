"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyJWT = exports.generateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_PRIVATEKEY = process.env.JWT_PRIVATEKEY;
function generateJWT(id, expires_sec = 365 * 24 * 60 * 60) {
    const options = {
        expiresIn: expires_sec,
    };
    const token = jsonwebtoken_1.default.sign({ id }, JWT_PRIVATEKEY, options);
    console.log("generateJWT Token", token, "verify", verifyJWT(token), "id", id);
    return token;
}
exports.generateJWT = generateJWT;
function verifyJWT(token) {
    try {
        const result = jsonwebtoken_1.default.verify(token, JWT_PRIVATEKEY);
        if (result.id && result.id != "")
            return result.id;
        else {
            console.error("verifyJWT - Wrong token", token, result);
            return undefined;
        }
    }
    catch (error) {
        console.error("verifyJWT catch - Wrong token", token, error);
        return undefined;
    }
}
exports.verifyJWT = verifyJWT;
//# sourceMappingURL=jwt.js.map