"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLanguage = exports.initLanguages = exports.getT = void 0;
const i18next_1 = __importDefault(require("i18next"));
const users_1 = __importDefault(require("../table/users"));
const en_json_1 = __importDefault(require("../locales/en.json"));
const it_json_1 = __importDefault(require("../locales/it.json"));
const tr_json_1 = __importDefault(require("../locales/tr.json"));
async function initLanguages() {
    await i18next_1.default.init({
        fallbackLng: 'en',
        debug: false,
        resources: {
            en: { translation: en_json_1.default },
            it: { translation: it_json_1.default },
            tr: { translation: tr_json_1.default },
        }
    });
}
exports.initLanguages = initLanguages;
async function getLanguage(id) {
    const users = new users_1.default(process.env.DYNAMODB_TABLE);
    const LANGUAGE = await users.getCurrentLanguage(id);
    return LANGUAGE;
}
exports.getLanguage = getLanguage;
function getT(language) {
    const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    return i18next_1.default.getFixedT(language || systemLocale);
}
exports.getT = getT;
//# sourceMappingURL=lang.js.map